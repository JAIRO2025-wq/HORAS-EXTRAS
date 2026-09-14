import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getAuthContext } from '@/lib/auth-server';

const sharesDir = path.join(process.cwd(), 'data', 'report-shares');

/**
 * Guarda un snapshot del reporte de horas extra para consulta pública vía QR.
 * Devuelve un ID corto que se usa en la URL /r/[id].
 */
export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { employeeName, month, quincena, records } = body || {};

    if (!employeeName || !month || !Array.isArray(records)) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const id = crypto.randomBytes(6).toString('hex');

    const payload = {
      id,
      employeeName,
      month,
      quincena: quincena ?? null,
      records,
      createdAt: new Date().toISOString(),
      createdBy: auth.name,
    };

    await fs.mkdir(sharesDir, { recursive: true });
    await fs.writeFile(path.join(sharesDir, `${id}.json`), JSON.stringify(payload, null, 2), 'utf-8');

    return NextResponse.json({ id });
  } catch (error) {
    console.error('Error al guardar el reporte compartido:', error);
    return NextResponse.json({ error: 'Error al guardar el reporte' }, { status: 500 });
  }
}
