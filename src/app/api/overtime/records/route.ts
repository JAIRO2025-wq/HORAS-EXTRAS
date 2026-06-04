import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { OvertimeRecord } from '@/lib/types';
import { headers } from 'next/headers';
import { getAuthContext } from '@/lib/auth-server';

const dataDir = path.join(process.cwd(), 'data');

function sanitize(str: string) {
  return str.replace(/[^a-z0-9]/gi, '_').toUpperCase();
}

/**
 * Genera el path jerárquico: data/records/[AÑO]/[MES]/[QX]/[NOMBRE].json
 */
async function getHierarchicalPath(userName: string, accountingMonth: string, quincena: number, date: Date) {
    const year = date.getFullYear().toString();
    const sUser = sanitize(userName);
    const sMonth = sanitize(accountingMonth);
    const qFolder = `Q${quincena}`;
    
    const targetDir = path.join(dataDir, 'records', year, sMonth, qFolder);
    await fs.mkdir(targetDir, { recursive: true });
    
    return path.join(targetDir, `${sUser}.json`);
}

export async function GET(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || '';
  const targetName = auth.role === 'admin' ? (searchParams.get('user') || auth.name) : auth.name;

  if (!month) return NextResponse.json({ error: 'Month required' }, { status: 400 });

  const year = new Date().getFullYear().toString();
  const sUser = sanitize(targetName);
  const sMonth = sanitize(month);
  
  let allRecords: OvertimeRecord[] = [];

  // 1. Leer registros de la nueva estructura (Q1 y Q2)
  for (const q of ['Q1', 'Q2']) {
    const filePath = path.join(dataDir, 'records', year, sMonth, q, `${sUser}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      allRecords = [...allRecords, ...data];
    } catch (e) {}
  }

  // 2. Consolidar con archivos antiguos (flat structure)
  // IMPORTANTE: Ahora se leen AMBOS y se combinan por ID para no perder datos de Junio
  try {
      const oldPath = path.join(dataDir, `${sUser}-${sMonth}.json`);
      const content = await fs.readFile(oldPath, 'utf-8');
      const oldData: OvertimeRecord[] = JSON.parse(content);
      
      oldData.forEach(oldRec => {
          if (!allRecords.some(r => r.id === oldRec.id)) {
              allRecords.push(oldRec);
          }
      });
  } catch (e) {}

  return NextResponse.json(allRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || '';
  const targetName = auth.role === 'admin' ? (searchParams.get('user') || auth.name) : auth.name;

  if (!month) return NextResponse.json({ error: 'Missing context' }, { status: 400 });

  const body: OvertimeRecord = await request.json();
  const recordDate = new Date(body.date);
  const headersList = await headers();
  
  const newRecord: OvertimeRecord = {
    ...body,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    deviceInfo: headersList.get('user-agent') || 'Unknown',
    status: 'pending',
    type: body.type || 'overtime',
  };

  const filePath = await getHierarchicalPath(targetName, month, body.quincena, recordDate);
  
  let records: OvertimeRecord[] = [];
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    records = JSON.parse(content);
  } catch (e) {}

  records.push(newRecord);
  await fs.writeFile(filePath, JSON.stringify(records, null, 2));

  return NextResponse.json(newRecord, { status: 201 });
}
