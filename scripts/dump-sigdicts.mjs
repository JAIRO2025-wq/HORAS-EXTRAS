// Diagnóstico: vuelca los diccionarios /Sig y /Widget de un PDF firmado.
import fs from 'fs';

const file = process.argv[2] || 'data/pay-stubs/2026/Agosto/Q1/ADELIA_NOHEMY_VALVERDE_ROMERO.pdf';
const raw = fs.readFileSync(file);
const latin = raw.toString('latin1');

const objRe = /(\d+) 0 obj\n<<([\s\S]*?)\n>>\nendobj/g;
let m;
const sigDicts = [];
const widgetDicts = [];
while ((m = objRe.exec(latin)) !== null) {
  const inner = m[2];
  if (/\/Type\s*\/Sig/.test(inner)) sigDicts.push({ id: Number(m[1]), inner });
  if (/\/Type\s*\/Annot[\s\S]*?\/Subtype\s*\/Widget/.test(inner) || /\/Subtype\s*\/Widget/.test(inner)) {
    widgetDicts.push({ id: Number(m[1]), inner });
  }
}

console.log('=== Firmas ===');
for (const s of sigDicts) {
  console.log('--- obj#' + s.id + ' ---');
  for (const k of ['Reason', 'Location', 'Name', 'ContactInfo', 'M', 'SubFilter', 'Filter', 'T']) {
    const mm = s.inner.match(new RegExp('/' + k + '\\s*(.+)'));
    if (mm) console.log(k + ':', mm[1].trim().slice(0, 300));
  }
}

console.log('\n=== Widgets ===');
for (const w of widgetDicts) {
  console.log('--- obj#' + w.id + ' ---');
  for (const k of ['Rect', 'FT', 'T', 'V', 'F', 'AP', 'P', 'Subtype', 'Type']) {
    const mm = w.inner.match(new RegExp('/' + k + '\\s*(.+)'));
    if (mm) console.log(k + ':', mm[1].trim().slice(0, 200));
  }
}
