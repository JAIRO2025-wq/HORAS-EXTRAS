import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');

async function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
  try {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        await getAllFiles(fullPath, arrayOfFiles);
      } else if (file.toLowerCase().endsWith('.json')) {
        arrayOfFiles.push(fullPath);
      }
    }
  } catch (e) {}
  return arrayOfFiles;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');

  if (!month) {
    return NextResponse.json({ error: 'Month is required' }, { status: 400 });
  }

  const year = new Date().getFullYear().toString();
  const sMonth = month.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  let allAttendance: any[] = [];

  try {
    // 1. Nueva estructura
    const attDir = path.join(dataDir, 'attendance', year, sMonth);
    const files = await getAllFiles(attDir);

    for (const file of files) {
        try {
            const content = await fs.readFile(file, 'utf-8');
            allAttendance.push(...JSON.parse(content));
        } catch (e) {}
    }

    // 2. Fallback estructura flat
    const rootFiles = await fs.readdir(dataDir);
    const oldFiles = rootFiles.filter(f => f.startsWith('attendance-') && f.toUpperCase().endsWith(`-${sMonth}.JSON`));

    for (const file of oldFiles) {
        try {
            const content = await fs.readFile(path.join(dataDir, file), 'utf-8');
            const data = JSON.parse(content);
            data.forEach((r: any) => {
                if (!allAttendance.some(a => a.id === r.id)) {
                    allAttendance.push(r);
                }
            });
        } catch (e) {}
    }

    allAttendance.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return NextResponse.json(allAttendance);
  } catch (error) {
    return NextResponse.json([]);
  }
}
