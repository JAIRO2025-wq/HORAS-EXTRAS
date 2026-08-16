import fs from 'fs/promises';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const SIGNATURES_PATH = path.join(dataDir, 'signatures.json');

export type FirmaRegistro = {
  year: number;
  month: string;
  quincena: number;
  fileName: string;
  signedAt: string;
  ip: string;
  otpCode: string;
  rubricaPath?: string;
};

export type EnrollmentRecord = {
  name: string;
  dui: string;
  email: string;
  pfxBase64: string;
  enrolledAt: string;
  firmas: FirmaRegistro[];
};

export type SignaturesStore = Record<string, EnrollmentRecord>;

export function normalizeName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_').toUpperCase();
}

export async function readSignatures(): Promise<SignaturesStore> {
  try {
    const content = await fs.readFile(SIGNATURES_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

export async function writeSignatures(store: SignaturesStore): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(SIGNATURES_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

export async function getEnrollment(name: string): Promise<EnrollmentRecord | null> {
  const store = await readSignatures();
  return store[normalizeName(name)] ?? null;
}

export async function saveEnrollment(record: EnrollmentRecord): Promise<void> {
  const store = await readSignatures();
  store[normalizeName(record.name)] = record;
  await writeSignatures(store);
}

export async function recordSignature(name: string, firma: FirmaRegistro): Promise<void> {
  const store = await readSignatures();
  const key = normalizeName(name);
  const record = store[key];
  if (!record) throw new Error('Empleado no enrolado');
  record.firmas = record.firmas || [];
  record.firmas.push(firma);
  store[key] = record;
  await writeSignatures(store);
}

export async function saveRubrica(name: string, fileName: string, dataUri: string): Promise<string> {
  const base64 = dataUri.split(';base64,').pop();
  if (!base64) throw new Error('Rúbrica inválida');
  const folder = path.join(dataDir, 'signatures', normalizeName(name));
  await fs.mkdir(folder, { recursive: true });
  const filePath = path.join(folder, fileName);
  await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
  return filePath;
}
