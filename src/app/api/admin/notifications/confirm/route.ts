import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const logFilePath = path.join(dataDir, 'notifications_confirm.json');

export async function POST(request: Request) {
  try {
    const { employeeName, title, timestamp } = await request.json();
    console.log(`[DEBUG CONFIRM] Confirmación recibida de ${employeeName} para: ${title}`);

    let logs = [];
    try {
      const content = await fs.readFile(logFilePath, 'utf-8');
      logs = JSON.parse(content);
    } catch (e) {
      // Si no existe, empezamos con array vacío
    }

    const newLog = {
      id: crypto.randomUUID(),
      employeeName,
      title,
      receivedAt: timestamp,
      confirmedAt: new Date().toISOString()
    };

    logs.unshift(newLog);
    // Guardamos solo los últimos 50 logs para no saturar
    await fs.writeFile(logFilePath, JSON.stringify(logs.slice(0, 50), null, 2), 'utf-8');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DEBUG CONFIRM] Error guardando confirmación:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const content = await fs.readFile(logFilePath, 'utf-8');
    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    return NextResponse.json([]);
  }
}
