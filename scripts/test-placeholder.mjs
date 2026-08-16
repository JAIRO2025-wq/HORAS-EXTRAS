// Prueba del fork local plain-placeholder (binary + /AP) con cadena CA completa.
import fs from 'fs';
import path from 'path';
import forge from 'node-forge';
import { PDFDocument } from 'pdf-lib';
import signpdfModule from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { SUBFILTER_ETSI_CADES_DETACHED } from '@signpdf/utils';
import ph from '../src/lib/plain-placeholder.js';

const { plainAddPlaceholder } = ph;

function randomSerial() {
  return '01' + forge.util.bytesToHex(forge.random.getBytesSync(16));
}

function toPfx(privateKey, certs, password) {
  const asn1 = forge.pkcs12.toPkcs12Asn1(privateKey, certs, password, { algorithm: '3des' });
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary');
}

function loadCa() {
  const certPem = fs.readFileSync('data/certs/ca/ca-cert.pem', 'utf-8');
  const keyPem = fs.readFileSync('data/certs/ca/ca-key.pem', 'utf-8');
  return {
    cert: forge.pki.certificateFromPem(certPem),
    key: forge.pki.privateKeyFromPem(keyPem),
  };
}

function makeCert(ca, cn, extra) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = randomSerial();
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);
  cert.setSubject([{ name: 'commonName', value: cn }, ...(extra || [])]);
  cert.setIssuer(ca.cert.subject.attributes);
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, nonRepudiation: true, critical: true },
  ]);
  cert.sign(ca.key, forge.md.sha256.create());
  return { keys, cert };
}

async function sign(pdfBuffer, pfxBuffer, passphrase, meta) {
  const withPlaceholder = plainAddPlaceholder({
    pdfBuffer,
    reason: meta.reason,
    contactInfo: meta.contactInfo,
    name: meta.name,
    location: meta.location,
    subFilter: SUBFILTER_ETSI_CADES_DETACHED,
  });
  const signer = new P12Signer(pfxBuffer, { passphrase });
  const signpdf = signpdfModule.default || signpdfModule;
  return signpdf.sign(withPlaceholder, signer);
}

// Extrae el CMS y cuenta certificados (esperado: leaf + CA).
function countCmsCerts(pdfBuffer) {
  const latin = pdfBuffer.toString('latin1');
  const re = /\/Contents\s*<([0-9A-Fa-f]+)>/g;
  let m;
  const counts = [];
  while ((m = re.exec(latin)) !== null) {
    const full = Buffer.from(m[1], 'hex');
    // Extrae el CMS real por longitud DER (el resto es padding de ceros).
    if (full[0] !== 0x30) {
      counts.push(-2);
      continue;
    }
    const b1 = full[1];
    let headerLen;
    let contentLen;
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
  const ca = loadCa();

  const company = makeCert(ca, 'FLYNET BUSSINES AND SYSTEM SA DE CV - Representante Legal');
  const companyPfx = toPfx(company.keys.privateKey, [company.cert, ca.cert], 'empresa-pass');

  const employee = makeCert(ca, 'JAIRO ANTONIO HERNANDEZ GUEVARA', [
    { name: 'emailAddress', value: 'hg20025@ues.edu.sv' },
  ]);
  const employeePfx = toPfx(employee.keys.privateKey, [employee.cert, ca.cert], '123456');

  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  const page = doc.getPage(0);
  page.drawText('Recibo de pago de prueba', { x: 50, y: 400, size: 20 });
  let pdfBuffer = Buffer.from(await doc.save({ useObjectStreams: false }));
  console.log('PDF inicial:', pdfBuffer.length, 'bytes');

  pdfBuffer = await sign(pdfBuffer, companyPfx, 'empresa-pass', {
    name: 'FLYNET BUSSINES AND SYSTEM SA DE CV',
    reason: 'Firma de la Empresa - Emisor del recibo de pago',
    location: 'El Salvador',
    contactInfo: 'rrhh@flynet.com',
  });
  console.log('Tras Firma 1 (Empresa):', pdfBuffer.length, 'bytes');

  // Reason con acentos + Location largo => prueba el fix de encoding binary.
  pdfBuffer = await sign(pdfBuffer, employeePfx, '123456', {
    name: 'JAIRO ANTONIO HERNANDEZ GUEVARA',
    reason: 'Firma del Empleado - Aceptación del recibo de pago',
    location: 'IP: ::1 | Fecha: 2026-08-16T02:04:02.510Z | OTP: 814144',
    contactInfo: 'hg20025@ues.edu.sv',
  });
  console.log('Tras Firma 2 (Empleado):', pdfBuffer.length, 'bytes');

  const out = path.join(process.cwd(), 'scripts', '_double_signed.pdf');
  fs.writeFileSync(out, pdfBuffer);
  console.log('Escrito:', out);
  console.log('Certificados en cada CMS (esperado [2,2] = leaf+CA):', countCmsCerts(pdfBuffer));
}

main().catch((e) => {
  console.error('FALLO:', e);
  process.exit(1);
});
