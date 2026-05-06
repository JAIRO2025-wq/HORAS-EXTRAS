
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { cookies } from 'next/headers';
import type { Branch } from '@/lib/types';

const dataDir = path.join(process.cwd(), 'data');
const branchesFilePath = path.join(dataDir, 'branches.json');
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
    console.error('Failed to log branch mutation:', e);
  }
}

async function readBranchesFile(): Promise<Branch[]> {
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }

  try {
    const fileContent = await fs.readFile(branchesFilePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw new Error('Failed to read branches data');
  }
}

async function writeBranchesFile(data: Branch[]): Promise<void> {
  await fs.writeFile(branchesFilePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const isAdmin = cookieStore.get('admin_session')?.value;
        const branches = await readBranchesFile();
        
        // Si no es admin, ocultamos los deviceId para seguridad
        if (!isAdmin) {
            return NextResponse.json(branches.map(({ deviceId, ...rest }) => rest));
        }

        return NextResponse.json(branches);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { name, isUnrestricted, isAttendanceEnabled } = await request.json();
        const branches = await readBranchesFile();

        const newBranch: Branch = {
            id: branches.length > 0 ? Math.max(...branches.map(b => b.id)) + 1 : 1,
            name: name.trim(),
            deviceId: null,
            isUnrestricted: !!isUnrestricted,
            isAttendanceEnabled: !!isAttendanceEnabled,
        };

        branches.push(newBranch);
        await writeBranchesFile(branches);
        
        await logToBackend('branch_created', `Nueva sucursal creada: '${newBranch.name}'. Asistencia: ${newBranch.isAttendanceEnabled ? 'SI' : 'NO'}.`);

        return NextResponse.json(newBranch, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, name, deviceId, isUnrestricted, isAttendanceEnabled } = body;

        const branches = await readBranchesFile();
        const idx = branches.findIndex(b => b.id === id);

        if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        
        if (name !== undefined) branches[idx].name = name.trim();
        if (isUnrestricted !== undefined) branches[idx].isUnrestricted = isUnrestricted;
        if (isAttendanceEnabled !== undefined) branches[idx].isAttendanceEnabled = isAttendanceEnabled;
        
        if (deviceId !== undefined) {
          const oldDeviceId = branches[idx].deviceId;
          branches[idx].deviceId = deviceId;
          if (deviceId === null && oldDeviceId !== null) {
            await logToBackend('device_revoked', `Dispositivo revocado para la sucursal '${branches[idx].name}'.`);
          } else if (deviceId !== null && oldDeviceId === null) {
            await logToBackend('device_authorized', `Dispositivo autorizado para la sucursal '${branches[idx].name}'.`);
          }
        }

        await writeBranchesFile(branches);
        
        await logToBackend('branch_updated', `Sucursal '${branches[idx].name}' actualizada. Asistencia: ${branches[idx].isAttendanceEnabled ? 'SI' : 'NO'}.`);

        return NextResponse.json(branches[idx], { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();
        let branches = await readBranchesFile();
        const branchToDelete = branches.find(b => b.id === id);
        
        if (!branchToDelete) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        branches = branches.filter(b => b.id !== id);
        await writeBranchesFile(branches);
        
        await logToBackend('branch_deleted', `Sucursal eliminada: '${branchToDelete.name}'.`);

        return NextResponse.json({ message: 'Deleted' }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
