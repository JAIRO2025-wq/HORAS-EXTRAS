import fs from 'fs';
const raw = fs.readFileSync('data/pay-stubs/2026/Agosto/Q1/JAIRO_ANTONIO_HERNANDEZ_GUEVARA.pdf');
const latin = raw.toString('latin1');
const fmt = (s) => s.split('').map((c) => {
  const b = c.charCodeAt(0);
  return b < 32 || b > 126 ? `[${b.toString(16).padStart(2, '0')}]` : c;
}).join('');
let idx = latin.indexOf('/Reason');
let out = '';
while (idx > -1) {
  out += `Reason@${idx}:\n${fmt(latin.slice(idx, idx + 260))}\n\n`;
  const next = latin.indexOf('/Reason', idx + 1);
  if (next === -1) break;
  idx = next;
}
fs.writeFileSync('scripts/_reason_dump.txt', out);
console.log(out.length > 0 ? 'dumped' : 'nothing');
