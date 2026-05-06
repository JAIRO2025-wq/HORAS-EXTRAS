import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const quincena = searchParams.get('quincena');

  if (!year || !month || !quincena) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const targetFolder = path.join(dataDir, 'pay-stubs', year, month, `Q${quincena}`);

  try {
    await fs.access(targetFolder);
    const files = await fs.readdir(targetFolder);
    
    const stubs = files
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .map(f => ({
        fileName: f,
        employeeName: f.replace(/\.pdf$/i, '').replace(/_/g, ' ')
      }));

    return NextResponse.json(stubs);
  } catch (error) {
    return NextResponse.json([]);
  }
}
