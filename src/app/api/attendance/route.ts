import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { headers } from 'next/headers';
import type { AttendanceRecord } from '@/lib/types';
import { getAuthContext } from '@/lib/auth-server';

const dataDir = path.join(process.cwd(), 'data');

function sanitize(str: string) {
  return str.replace(/[^a-z0-9]/gi, '_').toUpperCase();
}

/**
 * Genera path jerárquico para asistencia: data/attendance/[AÑO]/[MES]/[QX]/[NOMBRE].json
 */
async function getHierarchicalPath(userName: string, accountingMonth: string, date: Date) {
    const year = date.getFullYear().toString();
    const sUser = sanitize(userName);
    const sMonth = sanitize(accountingMonth);
    
    // Determinamos quincena por fecha de la marca (lógica simple para asistencia)
    const qFolder = date.getDate() <= 15 ? 'Q1' : 'Q2';
    
    const targetDir = path.join(dataDir, 'attendance', year, sMonth, qFolder);
    await fs.mkdir(targetDir, { recursive: true });
    
    return path.join(targetDir, `${sUser}.json`);
}

export async function GET(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = sanitize(searchParams.get('month') || '');
  const targetUser = auth.role === 'admin' ? sanitize(searchParams.get('user') || '') : sanitize(auth.name);

  if (!targetUser || !month) return NextResponse.json([]);

  const year = new Date().getFullYear().toString();
  let allRecords: AttendanceRecord[] = [];

  // 1. Leer de la nueva estructura
  for (const q of ['Q1', 'Q2']) {
    const filePath = path.join(dataDir, 'attendance', year, month, q, `${targetUser}.json`);
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        allRecords = [...allRecords, ...JSON.parse(content)];
    } catch (e) {}
  }

  // 2. Consolidar con histórico antiguo (Merge)
  try {
      const oldPath = path.join(dataDir, `attendance-${targetUser}-${month}.json`);
      const content = await fs.readFile(oldPath, 'utf-8');
      const oldData: AttendanceRecord[] = JSON.parse(content);
      
      oldData.forEach(oldRec => {
          if (!allRecords.some(r => r.id === oldRec.id)) {
              allRecords.push(oldRec);
          }
      });
  } catch (e) {}

  return NextResponse.json(allRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = sanitize(searchParams.get('month') || '');
  const targetUser = auth.role === 'admin' ? (searchParams.get('user') || auth.name) : auth.name;
  const branch = searchParams.get('branch') || 'Unknown';

  if (!targetUser || !month) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

  const { type, employeeId } = await request.json();
  const headersList = await headers();
  const now = new Date();

  const newRecord: AttendanceRecord = {
    id: crypto.randomUUID(),
    timestamp: now.toISOString(),
    type,
    deviceInfo: headersList.get('user-agent') || 'PWA Terminal',
    employeeName: targetUser,
    employeeId: employeeId,
    branch,
    date: now.toISOString().split('T')[0],
  };

  const filePath = await getHierarchicalPath(targetUser, month, now);
  
  let records: AttendanceRecord[] = [];
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    records = JSON.parse(content);
  } catch (error) {}

  records.push(newRecord);
  await fs.writeFile(filePath, JSON.stringify(records, null, 2));

  return NextResponse.json(newRecord, { status: 201 });
}
