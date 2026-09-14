import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const subsFilePath = path.join(dataDir, 'push_subscriptions.json');

/**
 * Estructura del archivo:
 * {
 *   "NOMBRE DE USUARIO": {
 *     "role": "admin" | "employee",
 *     "devices": [ { endpoint, expirationTime, keys: { p256dh, auth } }, ... ]
 *   }
 * }
 *
 * Se soportan MÚLTIPLES dispositivos por usuario. Si el mismo usuario entra
 * desde varios equipos, todos reciben las notificaciones.
 */

type DeviceSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

type UserEntry = {
  role: 'admin' | 'employee';
  devices: DeviceSubscription[];
};

/**
 * Normaliza el archivo a la estructura nueva. Soporta migración desde el
 * formato antiguo (objeto plano { nombre: suscripcion }).
 */
function normalizeStore(raw: any): Record<string, UserEntry> {
  const store: Record<string, UserEntry> = {};
  if (!raw || typeof raw !== 'object') return store;

  for (const [key, value] of Object.entries<any>(raw)) {
    if (!value) continue;

    // Formato nuevo
    if (Array.isArray(value.devices)) {
      store[key] = {
        role: value.role === 'admin' ? 'admin' : 'employee',
        devices: value.devices.filter((d: any) => d && d.endpoint),
      };
      continue;
    }

    // Formato antiguo: { endpoint, keys } → migrar a un dispositivo
    if (value.endpoint && value.keys) {
      store[key] = {
        role: 'employee',
        devices: [value as DeviceSubscription],
      };
    }
  }

  return store;
}

/**
 * Registra o actualiza la vinculación entre un usuario y su dispositivo (suscripción push).
 */
export async function POST(request: Request) {
  try {
    const { subscription, employeeName, role } = await request.json();

    if (!subscription || !employeeName) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    let raw: any = {};
    try {
      const content = await fs.readFile(subsFilePath, 'utf-8');
      raw = JSON.parse(content);
    } catch (e) {
      // El archivo no existe o está vacío
    }

    const store = normalizeStore(raw);
    const userRole: 'admin' | 'employee' = role === 'admin' ? 'admin' : 'employee';

    const existing = store[employeeName];
    const devices = existing?.devices ? [...existing.devices] : [];

    // Reemplazar la suscripción del mismo dispositivo (mismo endpoint) o agregarla
    const idx = devices.findIndex(d => d.endpoint === subscription.endpoint);
    if (idx !== -1) {
      devices[idx] = subscription;
    } else {
      devices.push(subscription);
    }

    store[employeeName] = { role: userRole, devices };

    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(subsFilePath, JSON.stringify(store, null, 2), 'utf-8');

    console.log(`[PUSH] Dispositivo registrado para: ${employeeName} (${userRole}) - total: ${devices.length}`);

    return NextResponse.json({ success: true, devices: devices.length });
  } catch (error) {
    console.error('[PUSH SUBSCRIBE ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Elimina la suscripción de un dispositivo concreto (al cerrar sesión o
 * al detectar un cambio de rol).
 */
export async function DELETE(request: Request) {
  try {
    const { endpoint, employeeName } = await request.json();

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint requerido' }, { status: 400 });
    }

    let raw: any = {};
    try {
      raw = JSON.parse(await fs.readFile(subsFilePath, 'utf-8'));
    } catch (e) {
      return NextResponse.json({ success: true });
    }

    const store = normalizeStore(raw);

    for (const [key, entry] of Object.entries(store)) {
      // Si se indica el usuario, solo limpiar ese; si no, limpiar el endpoint en todos
      if (employeeName && key !== employeeName) continue;

      entry.devices = entry.devices.filter(d => d.endpoint !== endpoint);
      if (entry.devices.length === 0) {
        delete store[key];
      }
    }

    await fs.writeFile(subsFilePath, JSON.stringify(store, null, 2), 'utf-8');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PUSH UNSUBSCRIBE ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
