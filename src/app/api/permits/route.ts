
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import webpush from 'web-push';
import type { PermitRequest } from '@/lib/types';
import { getAuthContext } from '@/lib/auth-server';
import { parseISO, isWithinInterval } from 'date-fns';

const dataDir = path.join(process.cwd(), 'data');
const permitsFile = path.join(dataDir, 'permits.json');
const adminsFile = path.join(dataDir, 'admins.json');
const evidencesDir = path.join(dataDir, 'evidences');

async function sendPush(targetName: string, title: string, message: string, url: string = '/dashboard') {
  try {
    const keysPath = path.join(dataDir, 'vapid.json');
    const keysContent = await fs.readFile(keysPath, 'utf-8').catch(() => null);
    if (!keysContent) return;
    const keys = JSON.parse(keysContent);
    webpush.setVapidDetails('mailto:admin@flynet.com', keys.publicKey, keys.privateKey);

    const subsPath = path.join(dataDir, 'push_subscriptions.json');
    const subsContent = await fs.readFile(subsPath, 'utf-8').catch(() => '{}');
    const subscriptions = JSON.parse(subsContent);
    const sub = subscriptions[targetName];

    if (sub) {
      await webpush.sendNotification(sub, JSON.stringify({ 
        title: `📄 ${title}`, 
        body: message, 
        url: url,
        timestamp: new Date().toISOString(),
        employeeName: targetName
      }));
    }
  } catch (e) {
    console.error("Push Error:", e);
  }
}

async function notifyAdmins(title: string, message: string) {
    try {
        const content = await fs.readFile(adminsFile, 'utf-8').catch(() => '[]');
        const admins = JSON.parse(content);
        for (const admin of admins) {
            await sendPush(admin.name, title, message, '/admin/permits');
        }
    } catch (e) {
        console.error("Notify Admins Error:", e);
    }
}

async function readPermits(): Promise<PermitRequest[]> {
  try {
    const content = await fs.readFile(permitsFile, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return [];
  }
}

export async function GET(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let permits = await readPermits();

  if (from && to && auth.role === 'admin') {
    const fromDate = parseISO(from);
    const toDate = parseISO(to);
    permits = permits.filter(p => {
      const permitDate = parseISO(p.requestDate);
      return isWithinInterval(permitDate, { start: fromDate, end: toDate });
    });
  }
  
  if (auth.role === 'employee') {
    const filtered = permits.filter(p => p.employeeName === auth.name || p.supervisorName === auth.name);
    return NextResponse.json(filtered);
  }
  
  return NextResponse.json(permits);
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body: PermitRequest = await request.json();
    const permitId = crypto.randomUUID();
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
      requestDate: new Date().toISOString(),
      evidenceFileDataUri: finalEvidenceUri
    };

    const permits = await readPermits();
    permits.push(securePermit);
    await fs.writeFile(permitsFile, JSON.stringify(permits, null, 2));
    
    const title = 'Nueva Solicitud';
    const message = `${auth.name} solicita ${body.action}.`;

    if (body.supervisorName !== 'SIN AUTORIZACION') {
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
    const permits = await readPermits();
    const idx = permits.findIndex(p => p.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    
    const isJefe = auth.name === permits[idx].supervisorName;
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
            sendPush(permits[idx].employeeName, 'Permiso AUTORIZADO', `Tu solicitud de ${permits[idx].action} ha sido AUTORIZADA por Administración.`, '/dashboard?tab=permits');
        } else if (status === 'rejected') {
            newStatus = 'rejected';
            sendPush(permits[idx].employeeName, 'Permiso RECHAZADO', `Tu solicitud de ${permits[idx].action} fue rechazada por Administración.`, '/dashboard?tab=permits');
        }
    } 
    else if (isJefe) {
        if (oldStatus === 'pending' && status === 'approved') {
            newStatus = 'pending_admin'; 
            permits[idx].approvedBySupervisorAt = new Date().toISOString();
            await notifyAdmins('Permiso Avalado por Jefe', `${permits[idx].employeeName} espera tu firma final para ${permits[idx].action}.`);
        } else if (status === 'rejected') {
            newStatus = 'rejected';
            sendPush(permits[idx].employeeName, 'Permiso RECHAZADO', `Tu solicitud de ${permits[idx].action} fue rechazada por tu jefe.`, '/dashboard?tab=permits');
        }
    }

    permits[idx].status = newStatus;
    permits[idx].adminNotes = adminNotes || permits[idx].adminNotes || '';
    permits[idx].resolvedAt = new Date().toISOString();
    
    await fs.writeFile(permitsFile, JSON.stringify(permits, null, 2));
    return NextResponse.json(permits[idx]);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
