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

export async function GET(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = sanitize(searchParams.get('month') || '');
  const targetUser = auth.role === 'admin' ? sanitize(searchParams.get('user') || '') : sanitize(auth.name);

  if (!targetUser || !month) return NextResponse.json([]);

  const filePath = path.join(dataDir, `attendance-${targetUser}-${month}.json`);
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
  const month = sanitize(searchParams.get('month') || '');
  const targetUser = auth.role === 'admin' ? sanitize(searchParams.get('user') || '') : sanitize(auth.name);
  const branch = searchParams.get('branch') || 'Unknown';

  if (!targetUser || !month) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

  const { type, employeeId } = await request.json();
  const headersList = await headers();
  const now = new Date();

  const newRecord: AttendanceRecord = {
    id: crypto.randomUUID(),
    timestamp: now.toISOString(),
    type,
    deviceInfo: headersList.get('user-agent') || 'Unknown',
    employeeName: targetUser.replace(/_/g, ' '),
    employeeId: employeeId,
    branch,
    date: now.toISOString().split('T')[0],
  };

  const filePath = path.join(dataDir, `attendance-${targetUser}-${month}.json`);
  let records: AttendanceRecord[] = [];
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    records = JSON.parse(content);
  } catch (error) {}

  records.push(newRecord);
  await fs.writeFile(filePath, JSON.stringify(records, null, 2));

  return NextResponse.json(newRecord, { status: 201 });
}
