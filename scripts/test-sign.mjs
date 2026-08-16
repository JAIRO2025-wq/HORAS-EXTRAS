import fs from 'fs';
import path from 'path';
import forge from 'node-forge';
import { PDFDocument } from 'pdf-lib';
import signpdfModule from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { plainAddPlaceholder } from '@signpdf/placeholder-plain';
import { SUBFILTER_ETSI_CADES_DETACHED } from '@signpdf/utils';

function randomSerial() {
  return '01' + forge.util.bytesToHex(forge.random.getBytesSync(16));
}

function toPfx(privateKey, cert, password) {
  const asn1 = forge.pkcs12.toPkcs12Asn1(privateKey, cert, password, { algorithm: '3des' });
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary');
}

function makeCa() {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = randomSerial();
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
  const attrs = [{ name: 'commonName', value: 'Test CA' }, { name: 'countryName', value: 'SV' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { cert, key: keys.privateKey };
}

function makePfx(ca, cn, password) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = randomSerial();
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);
  cert.setSubject([{ name: 'commonName', value: cn }]);
  cert.setIssuer(ca.cert.subject.attributes);
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, nonRepudiation: true, critical: true },
  ]);
  cert.sign(ca.key, forge.md.sha256.create());
  return toPfx(keys.privateKey, cert, password);
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

async function main() {
  const ca = makeCa();
  const companyPfx = makePfx(ca, 'Empresa', 'empresa-pass');
  const employeePfx = makePfx(ca, 'Empleado', '123456');

  const doc = await PDFDocument.create();
  doc.addPage([600, 400]);
  const page = doc.getPage(0);
  page.drawText('Recibo de pago de prueba', { x: 50, y: 200, size: 20 });
  // useObjectStreams: false => pdf-lib escribe tabla xref clásica (compatible con @signpdf/placeholder-plain)
  let pdfBuffer = Buffer.from(await doc.save({ useObjectStreams: false }));

  console.log('PDF inicial bytes:', pdfBuffer.length, 'version:', pdfBuffer.slice(0, 10).toString());

  pdfBuffer = await sign(pdfBuffer, companyPfx, 'empresa-pass', {
    name: 'Empresa', reason: 'Firma empresa', location: 'SV', contactInfo: 'e@e.com',
  });
  console.log('Tras firma empresa bytes:', pdfBuffer.length);

  pdfBuffer = await sign(pdfBuffer, employeePfx, '123456', {
    name: 'Empleado', reason: 'Firma empleado', location: 'SV', contactInfo: 'u@u.com',
  });
  console.log('Tras firma empleado bytes:', pdfBuffer.length);

  const out = path.join(process.cwd(), 'scripts', 'test-output.pdf');
  fs.writeFileSync(out, pdfBuffer);
  console.log('OK - firmado doble, escrito en', out);
}

main().catch((e) => {
  console.error('FALLO:', e);
  process.exit(1);
});
