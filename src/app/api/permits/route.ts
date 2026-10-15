
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { PermitRequest } from '@/lib/types';
import { getAuthContext } from '@/lib/auth-server';
import { parseISO, isWithinInterval } from 'date-fns';
import { sendPushToUser, notifyAdmins } from '@/lib/push-server';
import { readAllPermits, getPermitFilePath } from '@/lib/permits-server';

const dataDir = path.join(process.cwd(), 'data');
const legacyPermitsFile = path.join(dataDir, 'permits.json');
const evidencesDir = path.join(dataDir, 'evidences');

async function sendPush(targetName: string, title: string, message: string, url: string = '/dashboard') {
  await sendPushToUser(targetName, title, message, url);
}

export async function GET(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const selectedMonth = searchParams.get('month');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let permits = await readAllPermits();

  if (auth.role === 'admin') {
    if (from && to) {
      const fromDate = parseISO(from);
      const toDate = parseISO(to);
      permits = permits.filter(p => {
        const permitDate = parseISO(p.requestDate || p.startDate);
        return isWithinInterval(permitDate, { start: fromDate, end: toDate });
      });
    } else if (selectedMonth) {
      permits = permits.filter(p => {
        const isPending = p.status === 'pending' || p.status === 'pending_admin';
        const d = parseISO(p.requestDate || p.startDate);
        const monthNames = [
          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        const recordMonth = monthNames[d.getMonth()];
        return isPending || recordMonth === selectedMonth;
      });
    }
  } 
  else if (auth.role === 'employee') {
    // NORMALIZACIÓN CRÍTICA: Comparar nombres ignorando mayúsculas y espacios extra
    const sessionName = auth.name.toUpperCase().trim();
    permits = permits.filter(p => {
      const pEmpName = (p.employeeName || "").toUpperCase().trim();
      const pSupName = (p.supervisorName || "").toUpperCase().trim();
      return pEmpName === sessionName || pSupName === sessionName;
    });
  }
  
  return NextResponse.json(permits);
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body: PermitRequest = await request.json();
    const permitId = crypto.randomUUID();
    const requestDate = new Date().toISOString();
    let finalEvidenceUri = body.evidenceFileDataUri;

    if (body.evidenceFileDataUri && body.evidenceFileDataUri.startsWith('data:')) {
      try {
        const [meta, base64Data] = body.evidenceFileDataUri.split(';base64,');
        const mimeType = meta.split(':')[1];
        const isPdf = mimeType.includes('pdf');
        const extension = isPdf ? 'pdf' : 
                         mimeType.includes('png') ? 'png' : 
                         mimeType.includes('webp') ? 'webp' : 'jpg';
        
        const fileName = `${permitId}.${extension}`;
        await fs.mkdir(evidencesDir, { recursive: true });
        
        const buffer = Buffer.from(base64Data, 'base64');
        await fs.writeFile(path.join(evidencesDir, fileName), buffer);
        
        finalEvidenceUri = `/api/permits/evidence?id=${permitId}&type=${isPdf ? 'pdf' : 'image'}`;
      } catch (fileError) {
        console.error("Error saving evidence file:", fileError);
      }
    }
    
    const securePermit: PermitRequest = {
      ...body,
      id: permitId,
      employeeName: auth.name,
      status: 'pending',
      requestDate: requestDate,
      evidenceFileDataUri: finalEvidenceUri
    };

    const filePath = await getPermitFilePath(requestDate);
    let permits: PermitRequest[] = [];
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      permits = JSON.parse(content);
    } catch (e) {}

    permits.push(securePermit);
    await fs.writeFile(filePath, JSON.stringify(permits, null, 2));
    
    const title = 'Nueva Solicitud';
    const message = `${auth.name} solicita ${body.action}.`;

    if (body.supervisorName && body.supervisorName !== 'SIN AUTORIZACION') {
        await sendPush(body.supervisorName, title, message, '/dashboard?tab=permits');
    }
    
    await notifyAdmins(title, message);

    return NextResponse.json(securePermit);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, status, adminNotes, adminName } = await request.json();
    
    const permitsBaseDir = path.join(dataDir, 'permits');
    const years = await fs.readdir(permitsBaseDir).catch(() => []);
    
    let foundFile: string | null = null;
    let permits: PermitRequest[] = [];
    let idx = -1;

    for (const year of years) {
      const yearDir = path.join(permitsBaseDir, year);
      const isDir = (await fs.stat(yearDir)).isDirectory();
      if (!isDir) continue;

      const monthFiles = await fs.readdir(yearDir).catch(() => []);
      for (const file of monthFiles) {
        const filePath = path.join(yearDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const data: PermitRequest[] = JSON.parse(content);
        const findIdx = data.findIndex(p => p.id === id);
        if (findIdx !== -1) {
          foundFile = filePath;
          permits = data;
          idx = findIdx;
          break;
        }
      }
      if (foundFile) break;
    }

    if (!foundFile) {
      try {
        const legacyContent = await fs.readFile(legacyPermitsFile, 'utf-8');
        const data: PermitRequest[] = JSON.parse(legacyContent);
        const findIdx = data.findIndex(p => p.id === id);
        if (findIdx !== -1) {
          foundFile = legacyPermitsFile;
          permits = data;
          idx = findIdx;
        }
      } catch (e) {}
    }

    if (idx === -1 || !foundFile) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    
    const isJefe = auth.name.toUpperCase().trim() === (permits[idx].supervisorName || "").toUpperCase().trim();
    const isAdmin = auth.role === 'admin';

    if (!isJefe && !isAdmin) {
      return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 });
    }

    const oldStatus = permits[idx].status;
    let newStatus = status;

    if (isAdmin) {
        if (status === 'approved') {
            newStatus = 'approved';
            permits[idx].approvedByAdminAt = new Date().toISOString();
            permits[idx].approvedByAdminName = adminName || auth.name;
            if (oldStatus === 'pending') {
                permits[idx].approvedBySupervisorAt = new Date().toISOString();
                permits[idx].supervisorName = `ADMIN (${auth.name})`;
            }
            sendPush(permits[idx].employeeName, 'Permiso AUTORIZADO', `Tu solicitud de ${permits[idx].action} ha sido AUTORIZADA.`, '/dashboard?tab=permits');
        } else if (status === 'rejected') {
            newStatus = 'rejected';
            sendPush(permits[idx].employeeName, 'Permiso RECHAZADO', `Tu solicitud de ${permits[idx].action} fue rechazada.`, '/dashboard?tab=permits');
        }
    } 
    else if (isJefe) {
        if (oldStatus === 'pending' && status === 'approved') {
            newStatus = 'pending_admin'; 
            permits[idx].approvedBySupervisorAt = new Date().toISOString();
            await notifyAdmins('Permiso Avalado por Jefe', `${permits[idx].employeeName} espera firma final.`);
        } else if (status === 'rejected') {
            newStatus = 'rejected';
            sendPush(permits[idx].employeeName, 'Permiso RECHAZADO', `Tu solicitud fue rechazada por tu jefe.`, '/dashboard?tab=permits');
        }
    }

    permits[idx].status = newStatus;
    permits[idx].adminNotes = adminNotes || permits[idx].adminNotes || '';
    permits[idx].resolvedAt = new Date().toISOString();
    
    await fs.writeFile(foundFile, JSON.stringify(permits, null, 2));
    return NextResponse.json(permits[idx]);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
