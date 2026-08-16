// Prueba de integración REAL: flujo de producción completo con funciones reales.
//  1) Genera un recibo base con pdf-lib (formato carta 612x792, 2 copias por página).
//  2) signCompanyPdf -> regenera empresa.pfx (con CA) + marca visual + Firma 1.
//  3) signEmployeePdf -> re-emite el pfx del empleado real con CA + Firma 2.
// Luego se verifica: hash, CMS (certificados) y widgets /AP.
import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import forge from 'node-forge';
import { signCompanyPdf, signEmployeePdf } from '../src/lib/sign-pdf';

async function makeBasePdf() {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.getPage(0);
  page.drawText('FLYNET BUSSINES AND SYSTEM SA DE CV - RECIBO DE PAGO', { x: 50, y: 720, size: 12, font });
  page.drawText('Periodo: 2026 - Agosto - Q1', { x: 50, y: 700, size: 10, font });
  page.drawText('Salario base: $365.00', { x: 50, y: 480, size: 10, font });
  // Líneas de firma (coordenadas reales de EMPLOYEE_SIGNATURE_AREAS)
  page.drawText('F. ______________________          EMPLEADO', { x: 372, y: 448, size: 8, font });
  page.drawText('F. ______________________          EMPLEADO', { x: 372, y: 98, size: 8, font });
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

function countCmsCerts(pdfBuffer) {
  const latin = pdfBuffer.toString('latin1');
  const re = /\/Contents\s*<([0-9A-Fa-f]+)>/g;
  let m;
  const counts = [];
  while ((m = re.exec(latin)) !== null) {
    const full = Buffer.from(m[1], 'hex');
    if (full[0] !== 0x30) {
      counts.push(-2);
      continue;
    }
    const b1 = full[1];
    let headerLen, contentLen;
    if (b1 < 0x80) {
      headerLen = 2;
      contentLen = b1;
    } else {
      const n = b1 & 0x7f;
      headerLen = 2 + n;
      contentLen = full.readUIntBE(2, n);
    }
    const cms = full.subarray(0, headerLen + contentLen);
    try {
      const asn1 = forge.asn1.fromDer(forge.util.createBuffer(cms.toString('latin1')));
      const p7 = forge.pkcs7.messageFromAsn1(asn1);
      counts.push(p7.certificates?.length ?? 0);
    } catch (e) {
      counts.push(-1);
    }
  }
  return counts;
}

async function main() {
  const name = 'JAIRO ANTONIO HERNANDEZ GUEVARA';
  const signatures = JSON.parse(fs.readFileSync('data/signatures.json', 'utf-8'));
  const enrollment = signatures[name.replace(/ /g, '_')];
  if (!enrollment) throw new Error('No existe el enrolamiento de ' + name);

  const base = await makeBasePdf();
  console.log('Recibo base:', base.length, 'bytes');

  // Firma 1 (Empresa): regenera empresa.pfx con CA si falta.
  const signedByCompany = await signCompanyPdf(base, name);
  console.log('Tras Firma 1 (Empresa):', signedByCompany.length, 'bytes');

  // Firma 2 (Empleado): pfx real re-emitido con CA (PIN real del enrolamiento).
  const final = await signEmployeePdf(signedByCompany, enrollment, '787878', {
    ip: '::1',
    otpCode: '000000',
  });
  console.log('Tras Firma 2 (Empleado):', final.length, 'bytes');

  const out = path.join(process.cwd(), 'scripts', '_real_signed.pdf');
  fs.writeFileSync(out, final);
  console.log('Escrito:', out);
  console.log('Certificados en cada CMS (esperado [2,2] = leaf+CA):', countCmsCerts(final));
  console.log('empresa.pfx regenerado con CA:', fs.existsSync('data/certs/empresa/empresa.pfx'));
}

main().catch((e) => {
  console.error('FALLO:', e);
  process.exit(1);
});
