import fs from 'fs/promises';
import path from 'path';
import forge from 'node-forge';

const dataDir = path.join(process.cwd(), 'data');
const caDir = path.join(dataDir, 'certs', 'ca');
const empresaDir = path.join(dataDir, 'certs', 'empresa');

const CA_CERT_PATH = path.join(caDir, 'ca-cert.pem');
const CA_KEY_PATH = path.join(caDir, 'ca-key.pem');
const EMPRESA_PFX_PATH = path.join(empresaDir, 'empresa.pfx');

// Contraseña por defecto del certificado de la Empresa.
// En producción se debe sobrescribir con EMPRESA_CERT_PASSWORD.
const EMPRESA_CERT_PASSWORD = process.env.EMPRESA_CERT_PASSWORD || 'flynet-empresa-2026';

function randomSerial(): string {
  return '01' + forge.util.bytesToHex(forge.random.getBytesSync(16));
}

function certDer(cert: forge.pki.Certificate): string {
  return forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
}

function sameCert(a: forge.pki.Certificate, b: forge.pki.Certificate): boolean {
  return certDer(a) === certDer(b);
}

/**
 * Genera el .pfx con la cadena completa [cert, caCert].
 * Incluir la CA en el PKCS#12 es imprescindible: @signpdf/signer-p12 agrega al
 * CMS (firma) todos los certificados del pfx, y sin la CA Adobe no puede
 * construir la cadena de confianza ("certificado del firmante no es válido").
 */
function toDer(privateKey: forge.pki.rsa.PrivateKey, certs: forge.pki.Certificate[], password: string): Buffer {
  const leaf = certs[0];
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    privateKey,
    certs,
    password,
    { algorithm: '3des', friendlyName: leaf.subject.getField('CN')?.value || 'certificado' }
  );
  const der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(der, 'binary');
}

/**
 * Asegura que un .pfx de empleado (base64) incluya la CA raíz en la cadena.
 * Los certificados creados antes de este fix no la traen; al firmar se vuelve
 * a emitir el pfx con la misma clave y el mismo PIN, agregando la CA.
 */
export async function ensurePfxWithChain(pfxBase64: string, pin: string): Promise<Buffer> {
  const { certPem } = await ensureCA();
  const caCert = forge.pki.certificateFromPem(certPem);

  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(Buffer.from(pfxBase64, 'base64').toString('binary')));
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, pin);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag];
  const privateKey = keyBags?.[0]?.key;
  if (!privateKey) throw new Error('No se encontró la clave privada en el certificado');

  const certs = (certBags ?? [])
    .map((bag) => bag.cert)
    .filter((c): c is forge.pki.Certificate => Boolean(c));
  if (certs.some((c) => sameCert(c, caCert))) return Buffer.from(pfxBase64, 'base64');

  const leaf =
    certs.find(
      (c) =>
        (c.publicKey as forge.pki.rsa.PublicKey).n.compareTo(privateKey.n) === 0 &&
        (c.publicKey as forge.pki.rsa.PublicKey).e.compareTo(privateKey.e) === 0
    ) ?? certs[0];
  if (!leaf) throw new Error('No se encontró el certificado del firmante en el .pfx');

  return toDer(privateKey, [leaf, caCert], pin);
}

async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * FASE 1 - CA Raíz de la Empresa.
 * Se genera una única vez y firma todos los certificados de empleados.
 */
export async function ensureCA(): Promise<{ certPem: string; keyPem: string }> {
  const [existingCert, existingKey] = await Promise.all([
    readFileIfExists(CA_CERT_PATH),
    readFileIfExists(CA_KEY_PATH),
  ]);

  if (existingCert && existingKey) {
    return { certPem: existingCert, keyPem: existingKey };
  }

  await fs.mkdir(caDir, { recursive: true });

  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = randomSerial();
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

  const attrs: forge.pki.CertificateField[] = [
    { name: 'commonName', value: 'FLYNET BUSSINES AND SYSTEM SA DE CV - Autoridad Certificadora Interna' },
    { name: 'organizationName', value: 'FLYNET BUSSINES AND SYSTEM SA DE CV' },
    { name: 'countryName', value: 'SV' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    { name: 'subjectKeyIdentifier' },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const certPem = forge.pki.certificateToPem(cert);
  const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

  await fs.writeFile(CA_CERT_PATH, certPem, 'utf-8');
  await fs.writeFile(CA_KEY_PATH, keyPem, 'utf-8');

  return { certPem, keyPem };
}

/**
 * Certificado .pfx de la Empresa (Firma 1). Se genera una sola vez.
 */
export async function ensureCompanyPfx(): Promise<{ pfxBuffer: Buffer; passphrase: string }> {
  try {
    const existing = await fs.readFile(EMPRESA_PFX_PATH);
    return { pfxBuffer: existing, passphrase: EMPRESA_CERT_PASSWORD };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const { certPem, keyPem } = await ensureCA();
  const caCert = forge.pki.certificateFromPem(certPem);
  const caKey = forge.pki.privateKeyFromPem(keyPem);

  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = randomSerial();
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

  cert.setSubject([
    { name: 'commonName', value: 'FLYNET BUSSINES AND SYSTEM SA DE CV - Representante Legal' },
    { name: 'organizationName', value: 'FLYNET BUSSINES AND SYSTEM SA DE CV' },
    { name: 'countryName', value: 'SV' },
  ]);
  cert.setIssuer(caCert.subject.attributes);
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, nonRepudiation: true, keyEncipherment: true, critical: true },
    { name: 'extKeyUsage', clientAuth: true, emailProtection: true },
  ]);
  cert.sign(caKey, forge.md.sha256.create());

  await fs.mkdir(empresaDir, { recursive: true });
  const pfxBuffer = toDer(keys.privateKey, [cert, caCert], EMPRESA_CERT_PASSWORD);
  await fs.writeFile(EMPRESA_PFX_PATH, pfxBuffer);

  return { pfxBuffer, passphrase: EMPRESA_CERT_PASSWORD };
}

/**
 * Genera el certificado individual .pfx (PKCS#12) de un empleado.
 * Se protege con el PIN de 6 dígitos como contraseña del PKCS#12.
 */
export async function createEmployeePfx(params: {
  name: string;
  dui: string;
  email: string;
  pin: string;
}): Promise<Buffer> {
  const { certPem, keyPem } = await ensureCA();
  const caCert = forge.pki.certificateFromPem(certPem);
  const caKey = forge.pki.privateKeyFromPem(keyPem);

  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = randomSerial();
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);

  cert.setSubject([
    { name: 'commonName', value: params.name },
    { name: 'serialNumber', value: params.dui },
    { name: 'emailAddress', value: params.email },
    { name: 'organizationName', value: 'FLYNET BUSSINES AND SYSTEM SA DE CV' },
    { name: 'countryName', value: 'SV' },
  ]);
  cert.setIssuer(caCert.subject.attributes);
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, nonRepudiation: true, critical: true },
    { name: 'extKeyUsage', emailProtection: true, clientAuth: true },
  ]);
  cert.sign(caKey, forge.md.sha256.create());

  return toDer(keys.privateKey, [cert, caCert], params.pin);
}
