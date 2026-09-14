import fs from 'fs/promises';
import path from 'path';
import webpush from 'web-push';

const dataDir = path.join(process.cwd(), 'data');
const subsFilePath = path.join(dataDir, 'push_subscriptions.json');
const vapidFile = path.join(dataDir, 'vapid.json');
const adminsFile = path.join(dataDir, 'admins.json');

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
 * Normaliza el archivo de suscripciones a la estructura multi-dispositivo.
 * Soporta el formato antiguo (objeto plano { nombre: suscripcion }).
 */
function normalizeStore(raw: any): Record<string, UserEntry> {
  const store: Record<string, UserEntry> = {};
  if (!raw || typeof raw !== 'object') return store;

  for (const [key, value] of Object.entries<any>(raw)) {
    if (!value) continue;

    if (Array.isArray(value.devices)) {
      store[key] = {
        role: value.role === 'admin' ? 'admin' : 'employee',
        devices: value.devices.filter((d: any) => d && d.endpoint),
      };
      continue;
    }

    if (value.endpoint && value.keys) {
      store[key] = { role: 'employee', devices: [value as DeviceSubscription] };
    }
  }

  return store;
}

/**
 * Envía una notificación push a TODOS los dispositivos registrados de un usuario.
 * Limpia automáticamente las suscripciones caducadas (404/410).
 */
export async function sendPushToUser(
  targetName: string,
  title: string,
  message: string,
  url: string
): Promise<void> {
  try {
    const keysContent = await fs.readFile(vapidFile, 'utf-8').catch(() => null);
    if (!keysContent) return;
    const keys = JSON.parse(keysContent);
    webpush.setVapidDetails('mailto:admin@flynet.com', keys.publicKey, keys.privateKey);

    const subsContent = await fs.readFile(subsFilePath, 'utf-8').catch(() => '{}');
    const store = normalizeStore(JSON.parse(subsContent));

    const entry = store[targetName];
    if (!entry || entry.devices.length === 0) return;

    const payload = JSON.stringify({
      title: `🔔 ${title}`,
      body: message,
      url,
      timestamp: new Date().toISOString(),
      employeeName: targetName,
    });

    const expiredEndpoints: string[] = [];

    await Promise.all(
      entry.devices.map(async (device) => {
        try {
          await webpush.sendNotification(device as any, payload);
        } catch (err: any) {
          // 404 / 410 = suscripción caducada → marcar para limpieza
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            expiredEndpoints.push(device.endpoint);
          } else {
            console.error(`[PUSH] Error enviando a ${targetName}:`, err?.message || err);
          }
        }
      })
    );

    // Limpiar suscripciones caducadas
    if (expiredEndpoints.length > 0) {
      entry.devices = entry.devices.filter(d => !expiredEndpoints.includes(d.endpoint));
      if (entry.devices.length === 0) {
        delete store[targetName];
      }
      await fs.writeFile(subsFilePath, JSON.stringify(store, null, 2), 'utf-8');
    }
  } catch (e) {
    console.error('[PUSH] Error general:', e);
  }
}

/**
 * Envía una notificación push a TODOS los administradores registrados.
 * Recorre admins.json y envía a cada uno a todos sus dispositivos.
 */
export async function notifyAdmins(
  title: string,
  message: string,
  url = '/admin/dashboard'
): Promise<void> {
  try {
    const content = await fs.readFile(adminsFile, 'utf-8').catch(() => '[]');
    const admins = JSON.parse(content);
    if (!Array.isArray(admins)) return;

    await Promise.all(
      admins.map((admin: any) => sendPushToUser(admin.name, title, message, url))
    );
  } catch (e) {
    console.error('[PUSH] Notify Admins Error:', e);
  }
}
