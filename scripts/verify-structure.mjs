import fs from 'fs';
import crypto from 'crypto';
import forge from 'node-forge';

const raw = fs.readFileSync(process.argv[2] || 'scripts/_double_signed.pdf');
const latin = raw.toString('latin1');

// 1) Estructura general
const sigs = (latin.match(/\/Type\s*\/Sig/g) || []).length;
const eofs = [...latin.matchAll(/%%EOF/g)].map((m) => m.index);
const prevs = [...latin.matchAll(/\/Prev\s+(\d+)/g)].map((m) => Number(m[1]));
console.log('Firmas (dict /Type /Sig):', sigs);
console.log('Marcadores %%EOF:', eofs.length, '-> revisiones:', eofs.length, '(original + firmas incrementales)');
console.log('Enlaces /Prev:', prevs);

// 2) Página: /Annots y AcroForm: /Fields (última versión de cada objeto)
function objectAt(offset) {
  let slice = latin.slice(offset);
  slice = slice.slice(0, slice.indexOf('endobj'));
  slice = slice.slice(slice.indexOf('<<') + 2);
  return slice.slice(0, slice.lastIndexOf('>>'));
}
function findLatestObject(dict, key) {
  // dict: contenido del dictionary -> regex sobre "N 0 obj\n<<..."
  const re = new RegExp(`([\\d]+) 0 obj\\n<<([\\s\\S]*?)\\n>>\\nendobj`, 'g');
  let m;
  let best = null;
  while ((m = re.exec(dict)) !== null) {
    const inner = m[2];
    if (inner.includes(`/${key}`)) {
      best = m;
    }
  }
  return best;
}
// Buscar la página (objeto con /MediaBox y /Type /Page) -> última ocurrencia
const pageRe = /(\d+) 0 obj\n<<([\s\S]*?)\n>>\nendobj/g;
let pageMatch = null;
let m;
while ((m = pageRe.exec(latin)) !== null) {
  if (/\/Type\s*\/Page[^s]/.test(m[2]) && !/\/Type\s*\/Pages/.test(m[2])) {
    pageMatch = m;
  }
}
if (pageMatch) {
  const annots = pageMatch[2].match(/\/Annots\s*\[([^\]]*)\]/);
  console.log('Pagina obj#' + pageMatch[1] + ' /Annots:', annots ? annots[1].trim() : '(sin /Annots)');
} else {
  console.log('Pagina: no encontrada');
}
const acroRe = /(\d+) 0 obj\n<<([\s\S]*?)\/Type\s*\/AcroForm([\s\S]*?)\n>>\nendobj/g;
let acroMatch = null;
while ((m = acroRe.exec(latin)) !== null) acroMatch = m;
if (acroMatch) {
  const fields = (acroMatch[2] + acroMatch[3]).match(/\/Fields\s*\[([^\]]*)\]/);
  console.log('AcroForm obj#' + acroMatch[1] + ' /Fields:', fields ? fields[1].trim() : '(sin /Fields)');
} else {
  console.log('AcroForm: no encontrado');
}

// 3) Verificación criptográfica de cada firma
const sigObjRe = /(\d+) 0 obj\n<<([\s\S]*?)\n>>\nendobj/g;
const infos = [];
while ((m = sigObjRe.exec(latin)) !== null) {
  const inner = m[2];
  const br = inner.match(/\/ByteRange\s*\[(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\]/);
  const contents = inner.match(/\/Contents\s*<([0-9A-Fa-f]+)>/);
  if (br && contents) {
    infos.push({ id: Number(m[1]), br: br.slice(1, 5).map(Number), hex: contents[1] });
  }
}
console.log('\nVerificación criptográfica (recomputo SHA-256 del ByteRange):');
for (const s of infos) {
  const [start, len1, start2, len2] = s.br;
  const signed = Buffer.concat([
    raw.subarray(start, start + len1),
    raw.subarray(start2, start2 + len2),
  ]);
  const recomputed = crypto.createHash('sha256').update(signed).digest();
  // Extraer digest del CMS (messageDigest attribute)
  let cmsDigest = null;
  let cmsOk = false;
  try {
    const der = Buffer.from(s.hex, 'hex');
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(der.toString('latin1')));
    const cms = forge.pkcs7.messageFromAsn1(asn1);
    const si = cms.signerInfoList?.[0];
    if (si && si.digest) {
      cmsDigest = Buffer.from(si.digest, 'binary');
      cmsOk = recomputed.equals(cmsDigest);
    }
  } catch (e) {
    // Si forge no pudo parsear, comparamos el SHA-256 del contenido firmado contra el digest MD
  }
  console.log(
    `  Firma #${s.id}: ByteRange=[${s.br.join(',')}] Contents=${s.hex.length / 2}B ` +
      (cmsOk ? 'OK digest coincide' : cmsDigest ? 'DIGEST NO COINCIDE' : '(forge no parseó CMS)')
  );
}
