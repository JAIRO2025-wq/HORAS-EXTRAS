import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { OvertimeRecord } from '@/lib/types';

const dataDir = path.join(process.cwd(), 'data');
const logFilePath = path.join(dataDir, 'events.log');

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

/**
 * Busca el path real del archivo de forma inteligente.
 * Soporta cambios de nombre (ej. de 3 a 4 nombres) buscando archivos que contengan partes del nombre.
 */
async function findActualFilePath(user: string, month: string) {
  const sanitizedUser = user.replace(/[^a-z0-9]/gi, '_').toUpperCase();
  const sanitizedMonth = month.replace(/[^a-z0-9]/gi, '_').toUpperCase();
  const expectedFull = `${sanitizedUser}-${sanitizedMonth}.JSON`;

  try {
    const files = await fs.readdir(dataDir);
    const filesUpper = files.map(f => f.toUpperCase());
    
    // 1. Intento exacto
    const exactIdx = filesUpper.indexOf(expectedFull);
    if (exactIdx !== -1) return path.join(dataDir, files[exactIdx]);

    // 2. Búsqueda difusa (si el usuario cambió de Jairo Guevara a Jairo Antonio Guevara Hernandez)
    // Buscamos archivos que terminen en el mes correcto y cuya parte de nombre coincida parcialmente
    const monthPattern = `-${sanitizedMonth}.JSON`;
    const potentialFiles = files.filter(f => {
        const fUpper = f.toUpperCase();
        if (!fUpper.endsWith(monthPattern) || fUpper.startsWith('ATTENDANCE-')) return false;
        
        const fileNamePart = fUpper.replace(monthPattern, '');
        // Coincidencia si el nombre nuevo contiene al viejo o viceversa
        return sanitizedUser.includes(fileNamePart) || fileNamePart.includes(sanitizedUser);
    });

    if (potentialFiles.length > 0) {
        // Devolvemos el primero que coincida (usualmente el más reciente o único)
        return path.join(dataDir, potentialFiles[0]);
    }
  } catch (e) {}

  // Por defecto si no existe nada, creamos el nuevo
  return path.join(dataDir, `${sanitizedUser}-${sanitizedMonth}.json`);
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
    await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { employeeName, month, record } = body;
        
        const filePath = await findActualFilePath(employeeName, month);
        const records = await readRecords(filePath);

        const newRecord = { 
            ...record, 
            id: crypto.randomUUID(), 
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
        
        const filePath = await findActualFilePath(employeeName, month);
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
        
        const filePath = await findActualFilePath(employeeName, month);
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
