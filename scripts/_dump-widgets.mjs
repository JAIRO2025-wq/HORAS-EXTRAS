// Inspección precisa de objetos widget/sig y sus /AP en un PDF firmado.
// Recorre TODOS los objetos del archivo (incluidas las revisiones incrementales)
// con un escáner de llaves balanceadas << >>.
import fs from 'fs';

const file = process.argv[2] || 'scripts/_double_signed.pdf';
const raw = fs.readFileSync(file);
const latin = raw.toString('latin1');
const fmt = (s) =>
  s
    .split('')
    .map((c) => {
      const b = c.charCodeAt(0);
      return b < 32 || b > 126 ? `[${b.toString(16).padStart(2, '0')}]` : c;
    })
    .join('');

// Encontrar cada objeto: "N 0 obj" ... "endobj" (con streams entre medio).
const objStartRe = /(\d+)\s+0\s+obj/g;
let startMatch;
while ((startMatch = objStartRe.exec(latin)) !== null) {
  const objNum = Number(startMatch[1]);
  const bodyStart = objStartRe.lastIndex;
  const endIdx = latin.indexOf('endobj', bodyStart);
  if (endIdx === -1) continue;
  let body = latin.slice(bodyStart, endIdx);

  // Quitar el stream (si lo hay) para analizar solo el diccionario.
  const streamIdx = body.indexOf('\nstream');
  if (streamIdx !== -1) {
    const endStream = body.indexOf('\nendstream', streamIdx);
    body = body.slice(0, streamIdx) + (endStream !== -1 ? body.slice(endStream) : '');
  }

  const isDict = body.trimStart().startsWith('<<');
  const isSig = /\/Type\s*\/Sig/.test(body) || /\/SubFilter/.test(body) || /\/ByteRange/.test(body);
  const isWidget = /\/Subtype\s*\/Widget/.test(body);
  const hasAp = /\/AP\s*<<[\s\S]*?\/N/.test(body) || /\/AP\s*<<[\s\S]*?\/N\s+\d+\s+\d+\s+R/.test(body);

  if ((isSig || isWidget || hasAp) && isDict) {
    console.log(`--- obj#${objNum} (${isWidget ? 'widget' : isSig ? 'sig' : 'dict'}${hasAp ? ' +/AP' : ''}) ---`);
    console.log(fmt(body.replace(/\s+/g, ' ').trim().slice(0, 800)));
    console.log();
  }
}
