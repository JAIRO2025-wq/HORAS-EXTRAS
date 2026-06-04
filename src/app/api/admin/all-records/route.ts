import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { OvertimeRecord } from '@/lib/types';

const dataDir = path.join(process.cwd(), 'data');

function sanitize(str: string) {
  return str.replace(/[^a-z0-9]/gi, '_').toUpperCase();
}

/**
 * Función auxiliar para leer recursivamente todos los JSON en una estructura de carpetas
 */
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
    const month = sanitize(searchParams.get('month') || '');

    if (!month) {
        return NextResponse.json({ error: 'Month is required' }, { status: 400 });
    }

    const year = new Date().getFullYear().toString();
    let allRecords: any[] = [];

    try {
        // 1. Intentar leer la nueva estructura jerárquica
        const monthDir = path.join(dataDir, 'records', year, month);
        const newFiles = await getAllFiles(monthDir);

        for (const file of newFiles) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                const records: OvertimeRecord[] = JSON.parse(content);
                const employeeName = path.basename(file, '.json').replace(/_/g, ' ');
                allRecords.push(...records.map(r => ({ ...r, employeeName })));
            } catch (e) {}
        }

        // 2. Compatibilidad con el directorio raíz (flat files)
        const rootFiles = await fs.readdir(dataDir);
        const oldMonthFiles = rootFiles.filter(file => {
            const fileUpper = file.toUpperCase();
            return fileUpper.endsWith(`-${month}.JSON`) && 
                   !fileUpper.startsWith('ATTENDANCE-');
        });

        for (const file of oldMonthFiles) {
            try {
                const content = await fs.readFile(path.join(dataDir, file), 'utf-8');
                const records: OvertimeRecord[] = JSON.parse(content);
                const employeeName = file.split('-')[0].replace(/_/g, ' ');
                // Evitar duplicados si ya se leyó de la nueva estructura
                records.forEach(r => {
                    if (!allRecords.some(ar => ar.id === r.id)) {
                        allRecords.push({ ...r, employeeName });
                    }
                });
            } catch (e) {}
        }
        
        allRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return NextResponse.json(allRecords);
    } catch (error) {
        console.error("Error en API all-records:", error);
        return NextResponse.json([]);
    }
}
