import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');

  if (!month) {
    return NextResponse.json({ error: 'Month is required' }, { status: 400 });
  }

  let allAttendance: any[] = [];

  try {
    const files = await fs.readdir(dataDir);
    const attendanceFiles = files.filter(f => f.startsWith('attendance-') && f.endsWith(`-${month}.json`));

    for (const file of attendanceFiles) {
        try {
            const content = await fs.readFile(path.join(dataDir, file), 'utf-8');
            const data = JSON.parse(content);
            allAttendance.push(...data);
        } catch (e) {}
    }

    allAttendance.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return NextResponse.json(allAttendance);
  } catch (error) {
    return NextResponse.json([]);
  }
}
