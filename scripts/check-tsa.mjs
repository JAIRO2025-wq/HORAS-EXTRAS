// Verifica que cada firma de un PDF tenga el sello de tiempo (RFC 3161):
//  1) existe el atributo NO firmado signatureTimeStampToken en el SignerInfo
//  2) el messageImprint del TSTInfo == SHA-256(encryptedDigest)
import fs from 'fs';
import crypto from 'crypto';
import forge from 'node-forge';

const file = process.argv[2] || 'scripts/_real_signed.pdf';
const raw = fs.readFileSync(file);
const latin = raw.toString('latin1');

const TST_OID = '1.2.840.113549.1.9.16.2.14';
const SHA256_OID = '2.16.840.1.101.3.4.2.1';

function extractCms(hex) {
  const full = Buffer.from(hex, 'hex');
  const b1 = full[1];
  let headerLen, contentLen;
  if (b1 < 0x80) { headerLen = 2; contentLen = b1; }
  else { const n = b1 & 0x7f; headerLen = 2 + n; contentLen = full.readUIntBE(2, n); }
  return full.subarray(0, headerLen + contentLen);
}

function findSig(tag, type) {
  return (c) => c && c.tagClass === tag && c.type === type;
}

function walkFor(node, pred) {
  if (pred(node)) return node;
  if (Array.isArray(node.value)) {
    for (const ch of node.value) {
      const r = walkFor(ch, pred);
      if (r) return r;
    }
  }
  return null;
}

const re = /\/Contents\s*<([0-9a-fA-F]+)>/g;
let m;
let i = 0;
while ((m = re.exec(latin)) !== null) {
  i++;
  const cms = extractCms(m[1]);
  const root = forge.asn1.fromDer(forge.util.createBuffer(cms.toString('latin1')));
  const signedData = root.value[1].value[0];
  const signerInfo = signedData.value[signedData.value.length - 1].value[0];

  const sigOctet = signerInfo.value.find(findSig(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING));
  const sigBytes = Buffer.from(sigOctet.value, 'binary');
  const expectedImprint = crypto.createHash('sha256').update(sigBytes).digest();

  // unauthenticatedAttributes = contexto [1]
  const unauth = signerInfo.value.find((c) => c.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && c.type === 1);
  const attr = unauth?.value?.[0];
  const attrOid = attr?.value?.[0]?.value ? forge.asn1.derToOid(attr.value[0].value) : undefined;
  const tokenContentInfo = attr?.value?.[1]?.value?.[0]; // SET { ContentInfo (SignedData) }

  // RFC 3161: TimeStampToken = ContentInfo { id-signedData } y el TSTInfo va
  // dentro del eContent (OCTET STRING) del SignedData.
  const contentTypeOid = tokenContentInfo?.value?.[0]?.value
    ? forge.asn1.derToOid(tokenContentInfo.value[0].value)
    : '';
  const tokenSignedData = tokenContentInfo?.value?.[1]?.value?.[0];
  const encapContent = tokenSignedData?.value?.[2];
  const eContentOctet = encapContent?.value?.[1]?.value?.[0];
  const tstInfo = eContentOctet
    ? forge.asn1.fromDer(forge.util.createBuffer(eContentOctet.value))
    : undefined;

  // TSTInfo: version, policy, messageImprint, serialNumber, genTime, ...
  const messageImprint = tstInfo?.value?.[2];
  const hashAlgOid = messageImprint?.value?.[0]?.value?.[0]?.value
    ? forge.asn1.derToOid(messageImprint.value[0].value[0].value)
    : undefined;
  const imprint = messageImprint?.value?.[1]?.value;
  const genTime = tstInfo?.value?.find((c) => c.tagClass === forge.asn1.Class.UNIVERSAL && c.type === forge.asn1.Type.GENERALIZEDTIME);

  const okOid = attrOid === TST_OID;
  const okImprint = imprint && Buffer.from(imprint, 'binary').equals(expectedImprint);
  const okAlg = hashAlgOid === SHA256_OID;

  console.log(`Firma #${i}:`);
  console.log(`  atributo signatureTimeStampToken: ${okOid ? 'SI' : 'NO (' + attrOid + ')'}`);
  console.log(`  contentType del token:            ${contentTypeOid || '(no parseado)'}`);
  console.log(`  hashAlgorithm del imprint:        ${okAlg ? 'SHA-256 OK' : 'OTRO (' + hashAlgOid + ')'}`);
  console.log(`  imprint == SHA-256(firma):        ${okImprint ? 'SI' : 'NO'}`);
  console.log(`  genTime (hora del TSA):           ${genTime ? genTime.value : '?'}`);
  console.log();
}
