import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthContext } from '@/lib/auth-server';
import type { EmployeeHistoryRecord } from '@/lib/types';

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

export async function GET(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const targetEmployee = searchParams.get('employee');

  const all = await readHistory();
  
  let filtered = all;
  if (auth.role === 'admin') {
    if (targetEmployee) {
      filtered = all.filter(r => r.employeeName === targetEmployee);
    }
  } else {
    filtered = all.filter(r => r.employeeName === auth.name);
  }

  return NextResponse.json(filtered.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()));
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
    if (auth.role !== 'admin' && record.employeeName !== auth.name) {
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
