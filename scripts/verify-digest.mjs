import fs from 'fs';
import crypto from 'crypto';
import forge from 'node-forge';

const raw = fs.readFileSync(process.argv[2]);
const latin = raw.toString('latin1');

const sigObjRe = /(\d+) 0 obj\n<<([\s\S]*?)\n>>\nendobj/g;
const infos = [];
let m;
while ((m = sigObjRe.exec(latin)) !== null) {
  const inner = m[2];
  const br = inner.match(/\/ByteRange\s*\[(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\]/);
  const contents = inner.match(/\/Contents\s*<([0-9A-Fa-f]+)>/);
  if (br && contents) infos.push({ id: Number(m[1]), br: br.slice(1, 5).map(Number), hex: contents[1] });
}

// Recorrer el árbol ASN.1 y devolver el valor del atributo messageDigest (OID 1.2.840.113549.1.9.4)
const MSG_DIGEST_OID = '1.2.840.113549.1.9.4';
const OID_REGEX = /^([0-9]+\.)+[0-9]+$/;
function findMessageDigest(node, oid = MSG_DIGEST_OID, inAttr = false) {
  if (!node || typeof node !== 'object') return null;
  const tag = node.tagClass === forge.asn1.Class.UNIVERSAL ? node.type : null;
  if (tag === forge.asn1.Type.OID && node.value === oid) {
    // buscar el valor OCTET STRING en los hermanos siguientes de este objeto SET/SEQUENCE
    return node._value_hex || null;
  }
  if (Array.isArray(node.value)) {
    for (let i = 0; i < node.value.length; i++) {
      const child = node.value[i];
      const found = findMessageDigest(child, oid);
      if (found) return found;
    }
  }
  return null;
}

function walkForOid(node, oid) {
  if (!node || typeof node !== 'object') return null;
  if (node.tagClass === forge.asn1.Class.UNIVERSAL && node.type === forge.asn1.Type.OID && node.value === oid) {
    return node;
  }
  if (Array.isArray(node.value)) {
    for (const child of node.value) {
      const r = walkForOid(child, oid);
      if (r) return r;
    }
  }
  return null;
}

// Buscar el OCTET STRING que es el valor del atributo messageDigest:
// el atributo es SEQUENCE { OID, SET { OCTET STRING } }
function findDigestValue(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.tagClass === forge.asn1.Class.UNIVERSAL && node.type === forge.asn1.Type.SEQUENCE && Array.isArray(node.value)) {
    const oidNode = node.value[0];
    if (oidNode && oidNode.tagClass === forge.asn1.Class.UNIVERSAL && oidNode.type === forge.asn1.Type.OID && oidNode.value === MSG_DIGEST_OID) {
      // node.value[1] es SET { OCTET STRING }
      const setNode = node.value[1];
      if (setNode && Array.isArray(setNode.value) && setNode.value[0]) {
        const oct = setNode.value[0];
        if (oct.tagClass === forge.asn1.Class.UNIVERSAL && oct.type === forge.asn1.Type.OCTETSTRING) {
          return Buffer.from(oct.value, 'binary');
        }
      }
    }
  }
  if (Array.isArray(node.value)) {
    for (const child of node.value) {
      const r = findDigestValue(child);
      if (r) return r;
    }
  }
  return null;
}

console.log('Verificación criptográfica de cada firma:');
for (const s of infos) {
  const [start, len1, start2, len2] = s.br;
  const signed = Buffer.concat([
    raw.subarray(start, start + len1),
    raw.subarray(start2, start2 + len2),
  ]);
  const recomputed = crypto.createHash('sha256').update(signed).digest();

  let expected = null;
  let error = null;
  try {
    const derBuf = forge.util.createBuffer(Buffer.from(s.hex, 'hex').toString('latin1'));
    const asn1 = forge.asn1.fromDer(derBuf);
    expected = findDigestValue(asn1);
  } catch (e) {
    error = e.message;
  }

  const ok = expected && expected.equals(recomputed);
  console.log(
    `  Firma #${s.id}: ByteRange=[${s.br.join(',')}] ` +
      (ok ? 'OK - hash SHA-256 del ByteRange coincide con el messageDigest del CMS' :
        error ? `ERROR parse CMS: ${error}` :
        expected ? 'NO COINCIDE el digest' : '(no se encontró messageDigest)')
  );
  if (!ok && expected) {
    console.log('    esperado:', expected.toString('hex').slice(0, 32) + '...');
    console.log('    calculado:', recomputed.toString('hex').slice(0, 32) + '...');
  }
}
