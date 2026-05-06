import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthContext } from '@/lib/auth-server';
import type { UserNotification } from '@/lib/types';

const dataDir = path.join(process.cwd(), 'data');
const notificationsFile = path.join(dataDir, 'user_notifications.json');

async function readNotifications(): Promise<UserNotification[]> {
  try {
    const content = await fs.readFile(notificationsFile, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return [];
  }
}

async function writeNotifications(data: UserNotification[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(notificationsFile, JSON.stringify(data, null, 2));
}

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const all = await readNotifications();
  // Los admins ven notificaciones enviadas o recibidas por ellos, empleados solo las suyas
  const filtered = all.filter(n => n.recipientName === auth.name);
  
  return NextResponse.json(filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
}

export async function PUT(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, read, all } = await request.json();
    let notifications = await readNotifications();

    if (all) {
      notifications = notifications.map(n => 
        n.recipientName === auth.name ? { ...n, read: true } : n
      );
    } else {
      const idx = notifications.findIndex(n => n.id === id && n.recipientName === auth.name);
      if (idx !== -1) {
        notifications[idx].read = read;
      }
    }

    await writeNotifications(notifications);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await request.json();
    let notifications = await readNotifications();
    notifications = notifications.filter(n => !(n.id === id && n.recipientName === auth.name));
    
    await writeNotifications(notifications);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
