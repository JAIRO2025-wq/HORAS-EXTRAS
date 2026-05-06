import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import webpush from 'web-push';
import { getAuthContext } from '@/lib/auth-server';
import type { UserNotification, Employee } from '@/lib/types';

const dataDir = path.join(process.cwd(), 'data');
const notificationsFile = path.join(dataDir, 'user_notifications.json');

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { target, title, message, url } = await request.json();

    if (!title || !message) {
      return NextResponse.json({ error: 'Título y mensaje son requeridos' }, { status: 400 });
    }

    // 1. Cargar datos necesarios
    const [keysContent, subsContent, empContent, notifContent] = await Promise.all([
      fs.readFile(path.join(dataDir, 'vapid.json'), 'utf-8').catch(() => null),
      fs.readFile(path.join(dataDir, 'push_subscriptions.json'), 'utf-8').catch(() => '{}'),
      fs.readFile(path.join(dataDir, 'employees.json'), 'utf-8').catch(() => '[]'),
      fs.readFile(notificationsFile, 'utf-8').catch(() => '[]')
    ]);

    const keys = keysContent ? JSON.parse(keysContent) : null;
    const subscriptions = JSON.parse(subsContent);
    const employees: Employee[] = JSON.parse(empContent);
    let allNotifications: UserNotification[] = JSON.parse(notifContent);

    // 2. Determinar destinatarios
    let targetNames: string[] = [];
    if (target === 'all') {
      targetNames = employees.filter(e => e.status === 'active').map(e => e.name);
    } else {
      targetNames = [target];
    }

    // 3. Guardar en el buzón interno
    const newNotifications: UserNotification[] = targetNames.map(name => ({
      id: crypto.randomUUID(),
      recipientName: name,
      title,
      message,
      date: new Date().toISOString(),
      read: false,
      type: 'info',
      sender: auth.name
    }));

    allNotifications = [...newNotifications, ...allNotifications];
    await fs.writeFile(notificationsFile, JSON.stringify(allNotifications, null, 2));

    // 4. Enviar Push
    let pushCount = 0;
    if (keys) {
      webpush.setVapidDetails('mailto:admin@flynet.com', keys.publicKey, keys.privateKey);
      
      const pushPromises = targetNames.map(async (name) => {
        const sub = subscriptions[name];
        if (sub) {
          try {
            await webpush.sendNotification(sub, JSON.stringify({
              title: `🔔 ${title.toUpperCase()}`,
              body: message,
              // URL específica para el buzón del empleado
              url: url || '/dashboard?tab=notifications',
              employeeName: name,
              timestamp: new Date().toISOString()
            }));
            pushCount++;
          } catch (e) {
            console.error(`Error push a ${name}:`, e);
          }
        }
      });
      await Promise.all(pushPromises);
    }

    return NextResponse.json({ success: true, count: targetNames.length, pushCount });

  } catch (error) {
    console.error('Error enviando notificación:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}