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
  } catch (e) {}
}

/**
 * Encuentra el archivo en la nueva estructura jerárquica
 */
async function getHierarchicalPath(user: string, month: string, quincena: number, date: Date) {
    const year = date.getFullYear().toString();
    const sUser = user.replace(/[^a-z0-9]/gi, '_').toUpperCase();
    const sMonth = month.replace(/[^a-z0-9]/gi, '_').toUpperCase();
    const qFolder = `Q${quincena}`;
    
    const targetDir = path.join(dataDir, 'records', year, sMonth, qFolder);
    await fs.mkdir(targetDir, { recursive: true });
    
    return path.join(targetDir, `${sUser}.json`);
}

/**
 * Obtiene la ruta del archivo antiguo (formato NOMBRE-MES.json)
 */
function getLegacyPath(user: string, month: string) {
    const sUser = user.replace(/[^a-z0-9]/gi, '_').toUpperCase();
    const sMonth = month.replace(/[^a-z0-9]/gi, '_').toUpperCase();
    return path.join(dataDir, `${sUser}-${sMonth}.json`);
}

async function readRecords(filePath: string): Promise<OvertimeRecord[]> {
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        return [];
    }
}

export async function POST(request: Request) {
    try {
        const { employeeName, month, record } = await request.json();
        const dateObj = new Date(record.date);
        
        const filePath = await getHierarchicalPath(employeeName, month, record.quincena, dateObj);
        const records = await readRecords(filePath);

        const newRecord = { 
            ...record, 
            id: crypto.randomUUID(), 
            createdAt: new Date().toISOString() 
        };
        records.push(newRecord);
        await fs.writeFile(filePath, JSON.stringify(records, null, 2));
        
        await logToBackend('record_created', `ADMIN CREÓ registro para '${employeeName}'.`);
        return NextResponse.json(newRecord, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const { employeeName, month, record: updatedRecord } = await request.json();
        const dateObj = new Date(updatedRecord.date);
        let idx = -1;
        let filePath = '';
        let records: OvertimeRecord[] = [];
        
        // 1. Buscar en la nueva estructura jerárquica en AMBAS quincenas
        for (const q of [1, 2]) {
            filePath = await getHierarchicalPath(employeeName, month, q, dateObj);
            records = await readRecords(filePath);
            idx = records.findIndex(r => r.id === updatedRecord.id);
            if (idx !== -1) break;
        }

        // 2. Si no se encuentra, buscar en el archivo legado
        if (idx === -1) {
            filePath = getLegacyPath(employeeName, month);
            records = await readRecords(filePath);
            idx = records.findIndex(r => r.id === updatedRecord.id);
        }

        if (idx === -1) {
            return NextResponse.json({ error: 'Record not found in any structure' }, { status: 404 });
        }

        // Actualizar el registro y guardar en la estructura jerárquica correspondiente
        records[idx] = { ...records[idx], ...updatedRecord };
        
        // Si el registro cambió de quincena, guardarlo en la carpeta correcta
        const newFilePath = await getHierarchicalPath(employeeName, month, records[idx].quincena, new Date(records[idx].date));
        await fs.writeFile(newFilePath, JSON.stringify(records, null, 2));
        
        // Si el archivo origen es distinto al destino (cambio de quincena), borrar del origen
        if (newFilePath !== filePath) {
            const oldRecords = await readRecords(filePath);
            const filteredOld = oldRecords.filter(r => r.id !== updatedRecord.id);
            await fs.writeFile(filePath, JSON.stringify(filteredOld, null, 2));
        }
        
        await logToBackend('record_updated', `ADMIN ACTUALIZÓ registro de '${employeeName}'.`);
        return NextResponse.json(records[idx]);
    } catch (error) {
        console.error("Error updating record:", error);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { employeeName, month, recordId, quincena, date } = await request.json();
        const dateObj = new Date(date);
        let idx = -1;
        let filePath = '';
        let records: OvertimeRecord[] = [];
        
        // 1. Buscar en la nueva estructura en AMBAS quincenas
        for (const q of [1, 2]) {
            filePath = await getHierarchicalPath(employeeName, month, q, dateObj);
            records = await readRecords(filePath);
            idx = records.findIndex(r => r.id === recordId);
            if (idx !== -1) break;
        }

        // 2. Si no está ahí, buscar en el legado
        if (idx === -1) {
            filePath = getLegacyPath(employeeName, month);
            records = await readRecords(filePath);
            idx = records.findIndex(r => r.id === recordId);
        }

        if (idx === -1) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }
        
        const filteredRecords = records.filter(r => r.id !== recordId);
        await fs.writeFile(filePath, JSON.stringify(filteredRecords, null, 2));
        
        await logToBackend('record_deleted', `ADMIN ELIMINÓ registro de '${employeeName}'.`);
        return NextResponse.json({ message: 'Deleted' });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
