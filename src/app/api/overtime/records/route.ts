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
 * Busca el archivo de registros soportando cambios de nombre parciales.
 */
async function findUserMonthFile(userName: string, monthName: string) {
    const sUser = sanitize(userName);
    const sMonth = sanitize(monthName);
    const exactName = `${sUser}-${sMonth}.json`;
    const exactPath = path.join(dataDir, exactName);

    try {
        await fs.access(exactPath);
        return exactPath;
    } catch (e) {
        // Si no es exacto, buscamos uno que coincida parcialmente
        try {
            const files = await fs.readdir(dataDir);
            const monthSuffix = `-${sMonth}.JSON`;
            const match = files.find(f => {
                const fUpper = f.toUpperCase();
                if (!fUpper.endsWith(monthSuffix) || fUpper.startsWith('ATTENDANCE-')) return false;
                const namePart = fUpper.replace(monthSuffix, '');
                return sUser.includes(namePart) || namePart.includes(sUser);
            });
            if (match) return path.join(dataDir, match);
        } catch (err) {}
    }
    return exactPath;
}

export async function GET(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || '';
  const targetName = auth.role === 'admin' ? (searchParams.get('user') || auth.name) : auth.name;

  if (!month) {
    return NextResponse.json({ error: 'Month required' }, { status: 400 });
  }

  const filePath = await findUserMonthFile(targetName, month);

  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return NextResponse.json(JSON.parse(fileContent));
  } catch (error) {
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || '';
  const targetName = auth.role === 'admin' ? (searchParams.get('user') || auth.name) : auth.name;

  if (!month) return NextResponse.json({ error: 'Missing context' }, { status: 400 });

  const body: OvertimeRecord = await request.json();
  const headersList = await headers();
  
  const newRecord: OvertimeRecord = {
    ...body,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    deviceInfo: headersList.get('user-agent') || 'Unknown',
    status: 'pending',
    type: body.type || 'overtime',
  };

  const filePath = await findUserMonthFile(targetName, month);
  let records: OvertimeRecord[] = [];
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    records = JSON.parse(content);
  } catch (e) {}

  records.push(newRecord);
  await fs.writeFile(filePath, JSON.stringify(records, null, 2));

  return NextResponse.json(newRecord, { status: 201 });
}
