import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import webpush from 'web-push';
import { getAuthContext } from '@/lib/auth-server';
import type { Employee, UserNotification } from '@/lib/types';
import { readSignatures, normalizeName } from '@/lib/signatures';
import { sendReminderEmail } from '@/lib/mailer';

const dataDir = path.join(process.cwd(), 'data');
const notificationsFile = path.join(dataDir, 'user_notifications.json');
const employeesFile = path.join(dataDir, 'employees.json');

/**
 * POST /api/admin/firmas/recordatorios
 * Envía recordatorios (buzón interno + push + correo) a empleados con recibo sin firmar.
 * Si se envía `employeeNames`, solo se notifica a esos empleados.
 */
export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { year, month, quincena, employeeNames } = await request.json();
  if (!year || !month || !quincena) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  const stubFolder = path.join(dataDir, 'pay-stubs', year, month, `Q${quincena}`);

  const [keysContent, subsContent, empContent, notifContent, store, stubs] = await Promise.all([
    fs.readFile(path.join(dataDir, 'vapid.json'), 'utf-8').catch(() => null),
    fs.readFile(path.join(dataDir, 'push_subscriptions.json'), 'utf-8').catch(() => '{}'),
    fs.readFile(employeesFile, 'utf-8').catch(() => '[]'),
    fs.readFile(notificationsFile, 'utf-8').catch(() => '[]'),
    readSignatures(),
    fs.readdir(stubFolder).catch(() => [] as string[]),
  ]);

  const keys = keysContent ? JSON.parse(keysContent) : null;
  const subscriptions = JSON.parse(subsContent) as Record<string, any>;
  const employees = JSON.parse(empContent) as Employee[];
  let allNotifications = JSON.parse(notifContent) as UserNotification[];

  const stubKeys = new Set(
    stubs.filter((f) => f.toLowerCase().endsWith('.pdf')).map((f) => f.replace(/\.pdf$/i, '').toUpperCase())
  );

  const requested = employeeNames && employeeNames.length ? new Set(employeeNames) : null;

  const targets = employees.filter((emp) => {
    if (emp.status !== 'active') return false;
    if (requested) return requested.has(emp.name);

    const key = normalizeName(emp.name);
    const enrollment = store[key];
    const hasReceipt = stubKeys.has(key);
    const signed = (enrollment?.firmas || []).some(
      (f) => f.year === Number(year) && f.month === month && f.quincena === Number(quincena)
    );
    return hasReceipt && !signed;
  });

  if (targets.length === 0) {
    return NextResponse.json({ success: true, count: 0, message: 'No hay empleados pendientes de firma' });
  }

  // 1. Buzón interno
  const newNotifications: UserNotification[] = targets.map((emp) => ({
    id: crypto.randomUUID(),
    recipientName: emp.name,
    title: 'Recibo pendiente de firma',
    message: `Tienes pendiente la firma electrónica de tu recibo de ${month} ${year} (Q${quincena}).`,
    date: new Date().toISOString(),
    read: false,
    type: 'alert' as const,
    sender: auth.name,
  }));

  allNotifications = [...newNotifications, ...allNotifications];
  await fs.writeFile(notificationsFile, JSON.stringify(allNotifications, null, 2));

  // 2. Push
  let pushCount = 0;
  if (keys) {
    webpush.setVapidDetails('mailto:admin@flynet.com', keys.publicKey, keys.privateKey);
    await Promise.all(
      targets.map(async (emp) => {
        const sub = subscriptions[emp.name];
        if (!sub) return;
        try {
          await webpush.sendNotification(
            sub,
            JSON.stringify({
              title: '🔔 RECIBO PENDIENTE DE FIRMA',
              body: `Firma tu recibo de ${month} ${year} (Q${quincena}).`,
              url: '/dashboard?tab=paystubs',
              employeeName: emp.name,
              timestamp: new Date().toISOString(),
            })
          );
          pushCount++;
        } catch (e) {
          console.error(`Error push a ${emp.name}:`, e);
        }
      })
    );
  }

  // 3. Correo (solo si el empleado está enrolado y tiene correo registrado)
  let emailDelivered = 0;
  for (const emp of targets) {
    const enrollment = store[normalizeName(emp.name)];
    if (enrollment?.email) {
      const res = await sendReminderEmail(enrollment.email, {
        employeeName: emp.name,
        year,
        month,
        quincena,
      });
      if (res.delivered) emailDelivered++;
    }
  }

  return NextResponse.json({ success: true, count: targets.length, pushCount, emailDelivered });
}
