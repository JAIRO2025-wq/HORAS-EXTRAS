import crypto from 'crypto';
import forge from 'node-forge';

/*
 * Sello de tiempo RFC 3161 (TSA) para firmas PAdES.
 *
 * Toma el CMS (PKCS#7) que ya generó @signpdf/signer-p12 y le agrega el
 * atributo NO firmado `signatureTimeStampToken` (OID 1.2.840.113549.1.9.16.2.14)
 * en el SignerInfo. El atributo es un TimeStampToken cuyo messageImprint es
 * el hash SHA-256 del valor de la firma (encryptedDigest).
 *
 * Como es un atributo NO firmado, NO se invalida la firma: la sustitución se
 * hace a nivel de árbol ASN.1 (parse->insert->encode) sin tocar los atributos
 * firmados (contentType/messageDigest) ni el encryptedDigest.
 */

const SIGNATURE_TIMESTAMP_OID = '1.2.840.113549.1.9.16.2.14'; // id-aa-signatureTimeStampToken
const ID_CT_TST_INFO = '1.2.840.113549.1.9.16.1.4'; // id-ct-TSTInfo
const SHA256_OID = '2.16.840.1.101.3.4.2.1';
const OID_SIGNED_DATA = '1.2.840.113549.1.7.2';

// TSA públicas. Se puede sobrescribir con TSA_URL (p. ej. la oficial de la CA).
const TSA_URLS = process.env.TSA_URL
  ? [process.env.TSA_URL]
  : [
      'https://freetsa.org/tsr',
      'http://timestamp.digicert.com',
      'http://timestamp.comodoca.com/rfc3161',
    ];

type Asn1 = forge.asn1.Asn1;

/** Hijos de un nodo ASN.1 (forge tipa `value` como `string | Asn1[]`). */
function children(node: Asn1 | undefined): Asn1[] {
  return Array.isArray(node?.value) ? (node.value as Asn1[]) : [];
}

/** Valor crudo de un nodo ASN.1 primitivo (string). */
function raw(node: Asn1 | undefined): string {
  return typeof node?.value === 'string' ? (node.value as string) : '';
}

/** Obtiene el buffer crudo del /Contents (corta por longitud DER para quitar padding de ceros). */
export function extractCmsFromHex(hex: string): Buffer {
  const full = Buffer.from(hex, 'hex');
  if (full[0] !== 0x30) throw new Error('El /Contents no comienza con SEQUENCE DER');
  const b1 = full[1];
  let headerLen: number;
  let contentLen: number;
  if (b1 < 0x80) {
    headerLen = 2;
    contentLen = b1;
  } else {
    const n = b1 & 0x7f;
    headerLen = 2 + n;
    contentLen = full.readUIntBE(2, n);
  }
  return full.subarray(0, headerLen + contentLen);
}

/** Construye un TimeStampReq RFC 3161 para el hash dado (SHA-256). */
function buildTimeStampReq(imprint: Buffer): Buffer {
  const messageImprint = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.OID,
        false,
        forge.asn1.oidToDer(SHA256_OID).getBytes()
      ),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, ''),
    ]),
    forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.OCTETSTRING,
      false,
      imprint.toString('binary')
    ),
  ]);

  const nonce = forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.INTEGER,
    false,
    forge.asn1.integerToDer(crypto.randomInt(1, 0x7fffffff)).getBytes()
  );

  const timeStampReq = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, '\x01'), // version 1
    messageImprint,
    nonce,
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.BOOLEAN, false, '\x01'), // certReq TRUE
  ]);
  return Buffer.from(forge.asn1.toDer(timeStampReq).getBytes(), 'binary');
}

/** Pide el TimeStampToken a la TSA y devuelve el ContentInfo (DER) del token. */
async function fetchTimeStampToken(imprint: Buffer): Promise<Buffer> {
  const req = buildTimeStampReq(imprint);
  let lastError: Error | null = null;

  for (const url of TSA_URLS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/timestamp-query',
          Accept: 'application/timestamp-reply',
        },
        body: new Uint8Array(req),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const resp = Buffer.from(await response.arrayBuffer());

      // TimeStampResp ::= SEQUENCE { status PKIStatusInfo, timeStampToken OPTIONAL }
      const asn1 = forge.asn1.fromDer(forge.util.createBuffer(resp.toString('binary')));
      const statusSeq = children(asn1)[0];
      const status = raw(children(statusSeq)[0]).charCodeAt(0);
      if (status !== 0 && status !== 1) {
        throw new Error(`TSA rechazó la solicitud (status ${status})`);
      }
      const token = children(asn1)[1];
      if (!token) throw new Error('TSA no devolvió timeStampToken');
      return Buffer.from(forge.asn1.toDer(token).getBytes(), 'binary');
    } catch (error) {
      lastError = error as Error;
      console.warn(`TSA ${url} falló: ${(error as Error).message}`);
    }
  }
  throw lastError ?? new Error('No hay TSA disponible');
}

/** Agrega el atributo signatureTimeStampToken al SignerInfo del CMS y re-encodea. */
export function addSignatureTimeStamp(cms: Buffer, token: Buffer): Buffer {
  const root = forge.asn1.fromDer(forge.util.createBuffer(cms.toString('binary')));
  const rootChildren = children(root);

  // ContentInfo: [OID signedData, [0] EXPLICIT SignedData]
  const signedData = children(rootChildren[1])[0];
  const contentTypeOid = rootChildren[0] ? forge.asn1.derToOid(raw(rootChildren[0])) : '';
  if (!signedData || contentTypeOid !== OID_SIGNED_DATA) {
    throw new Error('El CMS no es un SignedData');
  }
  const signedDataChildren = children(signedData);
  const signerInfos = signedDataChildren[signedDataChildren.length - 1];
  const signerInfo = children(signerInfos)[0];
  if (!signerInfo) throw new Error('No se encontró el SignerInfo');

  // Valor de la firma: el OCTET STRING directo del SignerInfo (encryptedDigest).
  const encryptedDigest = children(signerInfo).find(
    (c) => c.tagClass === forge.asn1.Class.UNIVERSAL && c.type === forge.asn1.Type.OCTETSTRING
  );
  if (!encryptedDigest) throw new Error('No se encontró el encryptedDigest');

  // UnauthenticatedAttributes: último elemento [1] IMPLICIT (si no existe, crear).
  const signerInfoChildren = children(signerInfo);
  const last = signerInfoChildren[signerInfoChildren.length - 1];
  let unauth: Asn1;
  if (last.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && last.type === 1) {
    unauth = last;
  } else {
    unauth = forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 1, true, []);
    (signerInfo.value as Asn1[]).push(unauth);
  }

  const tokenAsn1 = forge.asn1.fromDer(forge.util.createBuffer(token.toString('binary')));
  const attr = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.OID,
      false,
      forge.asn1.oidToDer(SIGNATURE_TIMESTAMP_OID).getBytes()
    ),
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [tokenAsn1]),
  ]);
  (unauth.value as Asn1[]).push(attr);

  return Buffer.from(forge.asn1.toDer(root).getBytes(), 'binary');
}

/**
 * Devuelve true si el CMS ya tiene el atributo NO firmado signatureTimeStampToken
 * en su SignerInfo. Se usa para no re-sellar: el CMS de la Firma 1 queda dentro
 * del ByteRange de la Firma 2, así que modificarlo después rompería su hash.
 */
export function hasSignatureTimeStamp(cms: Buffer): boolean {
  const root = forge.asn1.fromDer(forge.util.createBuffer(cms.toString('binary')));
  const rootChildren = children(root);
  const signedData = children(rootChildren[1])[0];
  const signedDataChildren = children(signedData);
  const signerInfos = signedDataChildren[signedDataChildren.length - 1];
  const signerInfo = children(signerInfos)[0];
  if (!signerInfo) return false;

  const signerInfoChildren = children(signerInfo);
  const last = signerInfoChildren[signerInfoChildren.length - 1];
  if (last.tagClass !== forge.asn1.Class.CONTEXT_SPECIFIC || last.type !== 1) {
    return false;
  }

  return children(last).some((attr) => {
    const oidNode = children(attr)[0];
    const oid = oidNode ? forge.asn1.derToOid(raw(oidNode)) : '';
    return oid === SIGNATURE_TIMESTAMP_OID;
  });
}

/**
 * Procesa un PDF ya firmado: a cada firma (/Contents) le agrega su sello de
 * tiempo. La sustitución se hace dentro del campo /Contents (excluido del
 * ByteRange) manteniendo el mismo largo, así las firmas siguen válidas.
 */
export async function applyTimeStampsToPdf(pdfBuffer: Buffer): Promise<Buffer> {
  let latin = pdfBuffer.toString('latin1');
  const re = /(\/Contents\s*<)([0-9a-fA-F]+)(>)/g;
  let m: RegExpExecArray | null;
  let changed = 0;

  while ((m = re.exec(latin)) !== null) {
    const hex = m[2];
    const cms = extractCmsFromHex(hex);

    // No re-sellar firmas que ya tienen sello: su CMS está dentro del ByteRange
    // de la firma siguiente y modificarlo rompería su hash.
    if (hasSignatureTimeStamp(cms)) continue;

    const token = await fetchTimeStampToken(
      crypto.createHash('sha256').update(signatureValueOf(cms)).digest()
    );
    const newCms = addSignatureTimeStamp(cms, token);
    let newHex = newCms.toString('hex');

    // El largo total del campo hex debe mantenerse (ByteRange no cambia).
    if (newHex.length > hex.length) {
      throw new Error(
        `El CMS con sello de tiempo no cabe en el placeholder (${newHex.length} > ${hex.length})`
      );
    }
    newHex = newHex.padEnd(hex.length, '0');
    latin = latin.slice(0, m.index + m[1].length) + newHex + latin.slice(m.index + m[1].length + hex.length);
    changed += 1;
  }

  if (changed === 0) throw new Error('No se encontraron firmas /Contents para sellar');
  return Buffer.from(latin, 'latin1');
}

/** Devuelve el encryptedDigest (bytes de la firma) dentro del CMS. */
function signatureValueOf(cms: Buffer): Buffer {
  const root = forge.asn1.fromDer(forge.util.createBuffer(cms.toString('binary')));
  const rootChildren = children(root);
  const signedData = children(rootChildren[1])[0];
  const signedDataChildren = children(signedData);
  const signerInfos = signedDataChildren[signedDataChildren.length - 1];
  const signerInfo = children(signerInfos)[0];
  const encryptedDigest = children(signerInfo).find(
    (c) => c.tagClass === forge.asn1.Class.UNIVERSAL && c.type === forge.asn1.Type.OCTETSTRING
  );
  if (!encryptedDigest) throw new Error('No se encontró el encryptedDigest');
  return Buffer.from(raw(encryptedDigest), 'binary');
}
