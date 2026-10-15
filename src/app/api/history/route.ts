import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthContext } from '@/lib/auth-server';
import type { EmployeeHistoryRecord } from '@/lib/types';
import { normalizeEmployeeName } from '@/lib/record-utils';
import { buildHistoryEntries } from '@/lib/history-utils';
import { readAllPermits, readEvidenceFiles } from '@/lib/permits-server';

const dataDir = path.join(process.cwd(), 'data');
const historyFile = path.join(dataDir, 'employee_history.json');
const historyDocsDir = path.join(dataDir, 'history_docs');

async function readHistory(): Promise<EmployeeHistoryRecord[]> {
  try {
    const content = await fs.readFile(historyFile, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return [];
  }
}

/**
 * GET /api/history
 *   - Por defecto: solo los documentos del expediente (comportamiento histórico).
 *   - ?consolidated=1: Historial del Colaborador completo, es decir los documentos
 *     del expediente MÁS los permisos del colaborador, en una sola línea de tiempo.
 */
export async function GET(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const targetEmployee = searchParams.get('employee');
  const consolidated = ['1', 'true', 'yes'].includes(
    (searchParams.get('consolidated') || '').toLowerCase()
  );

  const all = await readHistory();

  // Los nombres se comparan normalizados para que un colaborador no se pierda
  // por diferencias de espacios o mayúsculas entre archivos.
  const target = normalizeEmployeeName(targetEmployee || '');
  const session = normalizeEmployeeName(auth.name);

  const seesEveryone = auth.role === 'admin' && !target;
  const matches = (name?: string) => {
    const n = normalizeEmployeeName(name);
    if (seesEveryone) return true;
    return target ? n === target || n.includes(target) || target.includes(n) : n === session;
  };

  const documents = all.filter((r) => matches(r.employeeName));

  if (!consolidated) {
    return NextResponse.json(
      documents.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
    );
  }

  const [permits, evidenceFiles] = await Promise.all([readAllPermits(), readEvidenceFiles()]);
  const visiblePermits = permits.filter((p) => matches(p.employeeName));

  return NextResponse.json(buildHistoryEntries(documents, visiblePermits, evidenceFiles));
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { documentType, fileName, fileDataUri, notes } = await request.json();
    const id = crypto.randomUUID();
    const uploadDate = new Date().toISOString();

    if (!fileDataUri || !documentType) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    // Guardar archivo físico
    await fs.mkdir(historyDocsDir, { recursive: true });
    const [meta, base64Data] = fileDataUri.split(';base64,');
    const extension = fileName.split('.').pop() || 'file';
    const physicalFileName = `${id}.${extension}`;
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(path.join(historyDocsDir, physicalFileName), buffer);

    const newRecord: EmployeeHistoryRecord = {
      id,
      employeeName: auth.name,
      documentType,
      fileName,
      fileUrl: `/api/history/file?id=${id}&name=${encodeURIComponent(fileName)}`,
      uploadDate,
      notes
    };

    const history = await readHistory();
    history.push(newRecord);
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(historyFile, JSON.stringify(history, null, 2));

    return NextResponse.json(newRecord);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to upload' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await request.json();
    let history = await readHistory();
    const record = history.find(r => r.id === id);

    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Solo el admin o el dueño pueden borrar
    if (auth.role !== 'admin' && normalizeEmployeeName(record.employeeName) !== normalizeEmployeeName(auth.name)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Borrar archivo físico
    const files = await fs.readdir(historyDocsDir);
    const physicalFile = files.find(f => f.startsWith(id));
    if (physicalFile) {
      await fs.unlink(path.join(historyDocsDir, physicalFile));
    }

    history = history.filter(r => r.id !== id);
    await fs.writeFile(historyFile, JSON.stringify(history, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
