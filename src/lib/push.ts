import fs from 'fs/promises';
import path from 'path';
import webpush from 'web-push';

const dataDir = path.join(process.cwd(), 'data');
const subsFile = path.join(dataDir, 'push_subscriptions.json');
const VAPID_SUBJECT = 'mailto:admin@flynet.com';

async function ensureVapid(): Promise<boolean> {
  try {
    const keysContent = await fs.readFile(path.join(dataDir, 'vapid.json'), 'utf-8');
    const keys = JSON.parse(keysContent);
    webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey);
    return true;
  } catch {
    return false;
  }
}

async function loadSubscriptions(): Promise<Record<string, any>> {
  try {
    const content = await fs.readFile(subsFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export async function removePushSubscription(name: string): Promise<void> {
  try {
    const subs = await loadSubscriptions();
    if (!subs[name]) return;
    delete subs[name];
    await fs.writeFile(subsFile, JSON.stringify(subs, null, 2), 'utf-8');
    console.log(`[PUSH] Suscripción inválida eliminada: ${name}`);
  } catch (e) {
    console.error('[PUSH] No se pudo eliminar la suscripción:', e);
  }
}

/**
 * Envía una notificación push a un empleado por nombre.
 * Si la suscripción ya no es válida (404/410, "unsubscribed or expired"),
 * la elimina automáticamente para no seguir enviando a endpoints muertos.
 */
export async function sendPushNotification(
  name: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  if (!(await ensureVapid())) return false;

  const subs = await loadSubscriptions();
  const sub = subs[name];
  if (!sub) return false;

  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
    return true;
  } catch (e: any) {
    const status = e?.statusCode;
    if (status === 404 || status === 410) {
      console.warn(`[PUSH] Suscripción inválida (${status}) para ${name}, eliminando...`);
      await removePushSubscription(name);
    } else {
      console.error(`[PUSH] Error enviando a ${name}:`, e);
    }
    return false;
  }
}
