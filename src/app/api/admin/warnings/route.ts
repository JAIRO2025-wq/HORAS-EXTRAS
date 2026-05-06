import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { WarningRecord } from '@/lib/types';

const dataDir = path.join(process.cwd(), 'data');
const warningsFile = path.join(dataDir, 'warnings.json');

async function readWarnings(): Promise<WarningRecord[]> {
  try {
    const content = await fs.readFile(warningsFile, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return [];
  }
}

export async function GET() {
  const all = await readWarnings();
  return NextResponse.json(all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const warnings = await readWarnings();
    
    const newWarning: WarningRecord = {
      ...body,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };

    warnings.push(newWarning);
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(warningsFile, JSON.stringify(warnings, null, 2));

    return NextResponse.json(newWarning, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    let warnings = await readWarnings();
    warnings = warnings.filter(w => w.id !== id);
    await fs.writeFile(warningsFile, JSON.stringify(warnings, null, 2));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
