import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { OvertimeRecord } from '@/lib/types';
import { dedupeRecords } from '@/lib/record-utils';

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

/**
 * Busca recursivamente la carpeta del mes dentro de data/records/[AÑO],
 * comparando en MAYÚSCULAS para evitar fallos por case-sensitivity
 * (en Linux "Junio" !== "JUNIO").
 */
async function findMonthDir(year: string, month: string): Promise<string | null> {
  const yearDir = path.join(dataDir, 'records', year);
  try {
    const entries = await fs.readdir(yearDir, { withFileTypes: true });
    const target = month.toUpperCase();
    const match = entries.find(e => e.isDirectory() && e.name.toUpperCase() === target);
    return match ? path.join(yearDir, match.name) : null;
  } catch (e) {
    return null;
  }
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
        //    (búsqueda case-insensitive de la carpeta del mes)
        const monthDir = await findMonthDir(year, month);
        const newFiles = monthDir ? await getAllFiles(monthDir) : [];

        for (const file of newFiles) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                const records: OvertimeRecord[] = JSON.parse(content);
                const employeeName = path.basename(file, '.json').replace(/_/g, ' ');
                allRecords.push(...records.map(r => ({ ...r, employeeName })));
            } catch (e) {}
        }

        // 2. Compatibilidad con el directorio raíz (flat files)
        //    Se aceptan sufijos como "-JUNIO(1).json" o "-Junio(2).json"
        const rootFiles = await fs.readdir(dataDir);
        const oldMonthFiles = rootFiles.filter(file => {
            const fileUpper = file.toUpperCase();
            if (!fileUpper.endsWith('.JSON') || fileUpper.startsWith('ATTENDANCE-')) return false;
            const base = fileUpper.replace(/\.JSON$/, '').replace(/\(\d+\)$/, '');
            return base.endsWith(`-${month}`);
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
        
        allRecords = dedupeRecords(allRecords);
        allRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return NextResponse.json(allRecords);
    } catch (error) {
        console.error("Error en API all-records:", error);
        return NextResponse.json([]);
    }
}
