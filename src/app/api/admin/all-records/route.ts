
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { OvertimeRecord } from '@/lib/types';

const dataDir = path.join(process.cwd(), 'data');

function sanitize(str: string) {
  return str.replace(/[^a-z0-9]/gi, '_').toUpperCase();
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const month = sanitize(searchParams.get('month') || '');

    if (!month) {
        return NextResponse.json({ error: 'Month is required' }, { status: 400 });
    }

    let allRecords: any[] = [];

    try {
        const files = await fs.readdir(dataDir);
        
        // Búsqueda insensible a mayúsculas para evitar discrepancias
        const monthFiles = files.filter(file => {
            const fileUpper = file.toUpperCase();
            return fileUpper.endsWith(`-${month}.JSON`) && 
                   !fileUpper.startsWith('ATTENDANCE-') &&
                   !['BRANCHES.JSON', 'EMPLOYEES.JSON', 'SETTINGS.JSON', 'ADMINS.JSON', 'VAPID.JSON', 'PUSH_SUBSCRIPTIONS.JSON', 'USER_NOTIFICATIONS.JSON', 'EMPLOYEE_COUNTER.JSON', 'PERMITS.JSON', 'NOTIFICATIONS_CONFIRM.JSON'].includes(fileUpper);
        });

        for (const file of monthFiles) {
            try {
                const content = await fs.readFile(path.join(dataDir, file), 'utf-8');
                const records: OvertimeRecord[] = JSON.parse(content);
                const employeeName = file.split('-')[0].replace(/_/g, ' ');

                allRecords.push(...records.map(r => ({ ...r, employeeName })));
            } catch (e) {
                console.error(`Error leyendo archivo ${file}:`, e);
            }
        }
        
        allRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return NextResponse.json(allRecords);
    } catch (error) {
        console.error("Error en API all-records:", error);
        return NextResponse.json([]);
    }
}
