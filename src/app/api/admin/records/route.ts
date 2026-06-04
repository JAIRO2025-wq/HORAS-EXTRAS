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
        
        const filePath = await getHierarchicalPath(employeeName, month, updatedRecord.quincena, dateObj);
        let records = await readRecords(filePath);
        
        const idx = records.findIndex(r => r.id === updatedRecord.id);
        if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        records[idx] = { ...records[idx], ...updatedRecord };
        await fs.writeFile(filePath, JSON.stringify(records, null, 2));
        
        await logToBackend('record_updated', `ADMIN ACTUALIZÓ registro de '${employeeName}'.`);
        return NextResponse.json(records[idx]);
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { employeeName, month, recordId, quincena, date } = await request.json();
        const dateObj = new Date(date);
        
        const filePath = await getHierarchicalPath(employeeName, month, quincena, dateObj);
        let records = await readRecords(filePath);
        
        records = records.filter(r => r.id !== recordId);
        await fs.writeFile(filePath, JSON.stringify(records, null, 2));
        
        await logToBackend('record_deleted', `ADMIN ELIMINÓ registro de '${employeeName}'.`);
        return NextResponse.json({ message: 'Deleted' });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
