import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { OvertimeRecord } from '@/lib/types';
import { isSameRecordContent } from '@/lib/record-utils';

const dataDir = path.join(process.cwd(), 'data');
const logFilePath = path.join(dataDir, 'events.log');

function sanitize(str: string) {
  return str.replace(/[^a-z0-9]/gi, '_').toUpperCase();
}

async function logToBackend(eventType: string, message: string) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      eventType,
      message,
    };
    await fs.appendFile(logFilePath, JSON.stringify(logEntry) + '\n', 'utf-8');
  } catch (e) {
    console.error('Failed to log record mutation:', e);
  }
}

async function readRecords(filePath: string): Promise<OvertimeRecord[]> {
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
    }
}

async function writeRecords(filePath: string, records: OvertimeRecord[]): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
}

/**
 * Path de la estructura nueva (jerárquica):
 * data/records/[AÑO]/[MES]/[Q1|Q2]/[NOMBRE].json
 */
function getHierarchicalPath(userName: string, month: string, quincena: number, date: Date) {
    const year = date.getFullYear().toString();
    const sUser = sanitize(userName);
    const sMonth = sanitize(month);
    const qFolder = `Q${quincena}`;
    return path.join(dataDir, 'records', year, sMonth, qFolder, `${sUser}.json`);
}

/**
 * Busca archivos de la estructura jerárquica que coincidan con el empleado y el mes,
 * sin importar el año o la quincena en que fueron guardados.
 */
async function findHierarchicalFiles(userName: string, month: string): Promise<string[]> {
    const sUser = sanitize(userName);
    const sMonth = sanitize(month);
    const recordsRoot = path.join(dataDir, 'records');
    const matches: string[] = [];

    async function walk(dir: string) {
        let entries;
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(full);
            } else if (entry.name.toUpperCase() === `${sUser}.JSON`) {
                if (full.toUpperCase().includes(sMonth)) {
                    matches.push(full);
                }
            }
        }
    }

    await walk(recordsRoot);
    return matches;
}

/**
 * Path legacy (flat) con búsqueda difusa para soportar cambios de nombre
 * (ej. de JAIRO GUEVARA a JAIRO ANTONIO HERNANDEZ GUEVARA).
 */
async function findLegacyFilePath(userName: string, month: string): Promise<string> {
    const sanitizedUser = sanitize(userName);
    const sanitizedMonth = sanitize(month);
    const expectedFull = `${sanitizedUser}-${sanitizedMonth}.JSON`;

    try {
        const files = await fs.readdir(dataDir);
        const filesUpper = files.map(f => f.toUpperCase());

        const exactIdx = filesUpper.indexOf(expectedFull);
        if (exactIdx !== -1) return path.join(dataDir, files[exactIdx]);

        const monthPattern = `-${sanitizedMonth}.JSON`;
        const potentialFiles = files.filter(f => {
            const fUpper = f.toUpperCase();
            if (!fUpper.endsWith(monthPattern) || fUpper.startsWith('ATTENDANCE-')) return false;

            const fileNamePart = fUpper.replace(monthPattern, '');
            return sanitizedUser.includes(fileNamePart) || fileNamePart.includes(sanitizedUser);
        });

        if (potentialFiles.length > 0) {
            return path.join(dataDir, potentialFiles[0]);
        }
    } catch (e) {}

    return path.join(dataDir, `${sanitizedUser}-${sanitizedMonth}.json`);
}

/**
 * Encuentra el archivo que realmente contiene el registro con el id dado,
 * buscando primero en la estructura jerárquica y luego en los archivos legacy.
 */
async function findFileForRecord(
    employeeName: string,
    month: string,
    recordId: string
): Promise<string | null> {
    // 1. Estructura jerárquica
    const hierarchicalFiles = await findHierarchicalFiles(employeeName, month);
    for (const filePath of hierarchicalFiles) {
        const records = await readRecords(filePath);
        if (records.some(r => r.id === recordId)) return filePath;
    }

    // 2. Archivos legacy (flat)
    const legacyPath = await findLegacyFilePath(employeeName, month);
    const legacyRecords = await readRecords(legacyPath);
    if (legacyRecords.some(r => r.id === recordId)) return legacyPath;

    return null;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { employeeName, month, record } = body;

        const recordDate = new Date(record.date);
        const quincena = record.quincena || (recordDate.getDate() <= 15 ? 1 : 2);
        const filePath = getHierarchicalPath(employeeName, month, quincena, recordDate);
        const records = await readRecords(filePath);

        // MITIGACIÓN ANTI-DUPLICADO: respeta el id del cliente (idempotencia)
        // y evita duplicar por contenido (doble click / reintento).
        const clientId = (record as any).id || crypto.randomUUID();
        const existingById = records.find(r => r.id === clientId);
        if (existingById) {
            return NextResponse.json(existingById, { status: 200 });
        }

        const duplicate = records.find(r => isSameRecordContent(r, record));
        if (duplicate) {
            return NextResponse.json(duplicate, { status: 200 });
        }

        const newRecord = { 
            ...record, 
            id: clientId, 
            createdAt: new Date().toISOString() 
        };
        records.push(newRecord);
        await writeRecords(filePath, records);
        
        const dateStr = new Date(newRecord.date).toLocaleDateString('es-ES');
        await logToBackend('record_created', `ADMIN CREÓ registro para '${employeeName}' (Fecha: ${dateStr}). Actividad: ${newRecord.activity}.`);

        return NextResponse.json(newRecord, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { employeeName, month, record: updatedRecord } = body;
        
        const filePath = await findFileForRecord(employeeName, month, updatedRecord.id);
        if (!filePath) {
            console.error(`Record ${updatedRecord.id} not found for '${employeeName}' (${month})`);
            return NextResponse.json({ error: 'Record not found in file' }, { status: 404 });
        }

        let records = await readRecords(filePath);
        
        const idx = records.findIndex(r => r.id === updatedRecord.id);
        if (idx === -1) {
            console.error(`Record ${updatedRecord.id} not found in ${filePath}`);
            return NextResponse.json({ error: 'Record not found in file' }, { status: 404 });
        }

        const oldRecord = records[idx];
        records[idx] = { ...records[idx], ...updatedRecord };
        await writeRecords(filePath, records);
        
        const dateStr = new Date(records[idx].date).toLocaleDateString('es-ES');
        let logMsg = `ADMIN ACTUALIZÓ registro de '${employeeName}' (${dateStr}).`;
        if (oldRecord.status !== records[idx].status) {
            logMsg = `ADMIN ${records[idx].status === 'approved' ? 'APROBÓ' : records[idx].status === 'rejected' ? 'RECHAZÓ' : 'puso en PENDIENTE'} el registro de '${employeeName}' del ${dateStr}.`;
        }
        await logToBackend('record_updated', logMsg);

        return NextResponse.json(records[idx], { status: 200 });
    } catch (error) {
        console.error("PUT Record Error:", error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const { employeeName, month, recordId } = body;
        
        const filePath = await findFileForRecord(employeeName, month, recordId);
        if (!filePath) {
            return NextResponse.json({ error: 'Record not found in file' }, { status: 404 });
        }

        let records = await readRecords(filePath);
        
        const recordToDelete = records.find(r => r.id === recordId);
        records = records.filter(r => r.id !== recordId);
        await writeRecords(filePath, records);
        
        const dateStr = recordToDelete ? new Date(recordToDelete.date).toLocaleDateString('es-ES') : 'Fecha desconocida';
        await logToBackend('record_deleted', `ADMIN ELIMINÓ registro de '${employeeName}' del ${dateStr}.`);

        return NextResponse.json({ message: 'Deleted' }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
