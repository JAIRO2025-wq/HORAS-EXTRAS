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

/**
 * Convierte "05:00 AM" / "06:30 PM" a minutos desde medianoche.
 * Devuelve null si el formato no es válido.
 */
function timeToMinutes(timeStr: string): number | null {
  const m = (timeStr || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const period = m[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

/**
 * Devuelve true si dos intervalos de tiempo se traslapan en el mismo día.
 * Maneja jornadas que cruzan medianoche (hora fin <= hora inicio).
 */
function isOverlapping(
  dateA: string, startA: string, endA: string,
  dateB: string, startB: string, endB: string
): boolean {
  const dayA = new Date(dateA).toISOString().slice(0, 10);
  const dayB = new Date(dateB).toISOString().slice(0, 10);
  if (dayA !== dayB) return false;

  const sA = timeToMinutes(startA);
  let eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  let eB = timeToMinutes(endB);
  if (sA === null || eA === null || sB === null || eB === null) return false;

  if (eA <= sA) eA += 1440;
  if (eB <= sB) eB += 1440;

  return sA < eB && eA > sB;
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
  
  // Respetamos el id generado por el cliente (idempotencia). Si no viene, generamos uno.
  const clientId = (body as any).id || crypto.randomUUID();
  
  const newRecord: OvertimeRecord = {
    ...body,
    id: clientId,
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

  // MITIGACIÓN ANTI-DUPLICADO:
  // Si ya existe un registro con el mismo id (reintento) o con el mismo contenido
  // (doble click / timeout de red), no lo duplicamos y devolvemos el existente.
  const existing = records.find(r => r.id === clientId);
  if (existing) {
    return NextResponse.json(existing, { status: 200 });
  }

  const duplicate = records.find(r =>
    r.date === newRecord.date &&
    r.startTime === newRecord.startTime &&
    r.endTime === newRecord.endTime &&
    (r.activity || '').trim().toLowerCase() === (newRecord.activity || '').trim().toLowerCase()
  );
  if (duplicate) {
    return NextResponse.json(duplicate, { status: 200 });
  }

  // VALIDACIÓN DE TRASLAPE: bloquea registrar en el mismo día y un lapso de
  // horas que ya está ocupado, aunque la actividad sea distinta.
  // Se excluyen los registros rechazados para permitir re-registrar.
  const overlap = records.find(r =>
    r.status !== 'rejected' &&
    isOverlapping(newRecord.date, newRecord.startTime, newRecord.endTime, r.date, r.startTime, r.endTime)
  );
  if (overlap) {
    return NextResponse.json(
      { error: 'Horario en conflicto: ya tienes horas registradas en este lapso.' },
      { status: 409 }
    );
  }

  records.push(newRecord);
  await fs.writeFile(filePath, JSON.stringify(records, null, 2));

  return NextResponse.json(newRecord, { status: 201 });
}
