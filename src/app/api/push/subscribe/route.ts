import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const subsFilePath = path.join(dataDir, 'push_subscriptions.json');

/**
 * Registra o actualiza la vinculación entre un usuario y su dispositivo (suscripción push).
 */
export async function POST(request: Request) {
  try {
    const { subscription, employeeName } = await request.json();

    if (!subscription || !employeeName) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    let subscriptions: Record<string, any> = {};
    try {
      const content = await fs.readFile(subsFilePath, 'utf-8');
      subscriptions = JSON.parse(content);
    } catch (e) {
      // El archivo no existe o está vacío
    }

    // Vincular la suscripción al nombre del empleado.
    // Esto permite que el sistema sepa a qué dispositivo enviarle mensajes 
    // basándose en quién inició sesión por última vez en este equipo.
    subscriptions[employeeName] = subscription;

    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(subsFilePath, JSON.stringify(subscriptions, null, 2), 'utf-8');

    console.log(`[PUSH] Dispositivo registrado para: ${employeeName}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PUSH SUBSCRIBE ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
