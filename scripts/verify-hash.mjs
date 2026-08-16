import fs from 'fs';
import crypto from 'crypto';

const file = process.argv[2];
if (!file) { console.error('usage: node verify-hash.mjs <file.pdf>'); process.exit(1); }
const raw = fs.readFileSync(file);
const latin = raw.toString('latin1');

// ---------- mini ASN.1 DER walker ----------
function readLen(buf, i) {
  let b0 = buf[i];
  let lenBytes = 1; // al menos 1 byte de longitud
  let len = b0;
  if (b0 & 0x80) {
    const nb = b0 & 0x7f;
    lenBytes = 1 + nb;
    len = 0;
    for (let k = 0; k < nb; k++) len = len * 256 + buf[i + 1 + k];
  }
  return { len, lenBytes };
}
function parse(buf, offset = 0) {
  const tag = buf[offset];
  const { len, lenBytes } = readLen(buf, offset + 1);
  const valueStart = offset + 1 + lenBytes; // tag + bytes de longitud
  const valueEnd = valueStart + len;
  return { tag, len, valueStart, valueEnd };
}
function children(buf, start, end) {
  const out = [];
  let i = start;
  while (i < end) {
    const p = parse(buf, i);
    out.push(p);
    i = p.valueEnd;
  }
  return out;
}
function slice(buf, p) {
  return buf.subarray(p.valueStart, p.valueEnd);
}
function bytesToHex(buf) {
  return buf.toString('hex').toUpperCase();
}

// ---------- extraer messageDigest del CMS ----------
function findMessageDigest(cms) {
  // cms: SEQUENCE (ContentInfo) -> [0] content = SignedData SEQUENCE
  const ci = parse(cms, 0);
  const ciKids = children(cms, ci.valueStart, ci.valueEnd);
  // ContentInfo: contentType OID, [0] content
  const content = ciKids.find((k) => (k.tag & 0xc0) === 0x80);
  if (!content) return { error: 'sin contenido [0]' };
  const sd = parse(cms, content.valueStart);
  const sdKids = children(cms, sd.valueStart, sd.valueEnd);
  // SignedData: version, digestAlgorithms, encapContentInfo, [0]certs?, signerInfos(SET)
  // el último hijo es signerInfos (SET tag 0x31)
  const signerInfos = sdKids[sdKids.length - 1];
  if (!signerInfos || signerInfos.tag !== 0x31) return { error: 'no SET de signerInfos' };
  const siKids = children(cms, signerInfos.valueStart, signerInfos.valueEnd);
  const si = siKids[0]; // SEQUENCE SignerInfo
  const fields = children(cms, si.valueStart, si.valueEnd);
  // fields: version(INT), sid(SEQ o [0]), digestAlg(SEQ), [0]signedAttrs?, sigAlg(SEQ), sig(OCTET)
  const signedAttrs = fields.find((f) => f.tag === 0xa0 && (f.len > 0));
  if (!signedAttrs) return { error: 'sin signedAttrs [0]' };
  // signedAttrs content = SET OF Attribute
  const attrs = children(cms, signedAttrs.valueStart, signedAttrs.valueEnd);
  const msgDigestOidHex = bytesToHex(oidToDerHex('1.2.840.113549.1.9.4'));
  for (const attr of attrs) {
    const attrKids = children(cms, attr.valueStart, attr.valueEnd);
    const oid = attrKids[0];
    if (!oid) continue;
    const oidHex = bytesToHex(slice(cms, oid));
    if (oidHex === msgDigestOidHex) {
      const values = attrKids[1];
      // SET OF OCTET STRING
      const vs = children(cms, values.valueStart, values.valueEnd);
      const oct = vs[0];
      if (oct && oct.tag === 0x04) return { digest: slice(cms, oct) };
      return { error: 'messageDigest sin OCTET STRING' };
    }
  }
  return { error: 'OID messageDigest no encontrado' };
}

let oidToDerHex;
try {
  const forgeMod = await import('node-forge');
  const forge = forgeMod.default || forgeMod;
  oidToDerHex = (s) => forge.asn1.oidToDer(s).toHex();
} catch (e) {
  // fallback manual para 1.2.840.113549.1.9.4
  oidToDerHex = (s) => {
    const parts = s.split('.').map(Number);
    const bytes = [40 * parts[0] + parts[1]];
    for (let i = 2; i < parts.length; i++) {
      let v = parts[i];
      const stack = [];
      do { stack.unshift(v & 0x7f); v >>>= 7; } while (v > 0);
      for (let k = 0; k < stack.length - 1; k++) stack[k] |= 0x80;
      bytes.push(...stack);
    }
    return Buffer.from(bytes).toString('hex');
  };
}

// ---------- firmas ----------
const objRe = /(\d+) 0 obj\n<<([\s\S]*?)\n>>\nendobj/g;
const sigs = new Map();
let m;
while ((m = objRe.exec(latin)) !== null) {
  const inner = m[2];
  if (inner.includes('/Type') && inner.includes('/Sig')) {
    const br = inner.match(/\/ByteRange\s*\[(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\]/);
    const contents = inner.match(/\/Contents\s*<([0-9A-Fa-f]+)>/);
    if (br && contents) sigs.set(Number(m[1]), { br: br.slice(1, 5).map(Number), hex: contents[1] });
  }
}

for (const [id, s] of [...sigs.entries()].sort((a, b) => a[0] - b[0])) {
  const [a, b, c, d] = s.br;
  const signed = Buffer.concat([raw.subarray(a, a + b), raw.subarray(c, c + d)]);
  const recomputed = crypto.createHash('sha256').update(signed).digest();

  const der = Buffer.from(s.hex, 'hex');
  let len = der[1], off = 2;
  if (len & 0x80) { const nb = len & 0x7f; len = 0; for (let i = 0; i < nb; i++) len = len * 256 + der[off + i]; off += nb; }
  const realLen = off + len;
  const cms = der.subarray(0, realLen);

  const res = findMessageDigest(cms);
  let match = null;
  if (res.digest) {
    match = recomputed.equals(res.digest);
    console.log(`\nFirma obj#${id}  ByteRange=[${s.br.join(',')}]`);
    console.log(`  SHA-256(ByteRange) = ${recomputed.toString('hex')}`);
    console.log(`  messageDigest(CMS)  = ${res.digest.toString('hex')}`);
    console.log(`  ==> Hash coincide: ${match ? 'SI' : 'NO  *** HASH ROTO ***'}`);
  } else {
    console.log(`\nFirma obj#${id}  ByteRange=[${s.br.join(',')}]`);
    console.log(`  Error extrayendo digest: ${res.error}`);
  }
}
