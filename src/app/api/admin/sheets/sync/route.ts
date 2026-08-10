import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const cacheFilePath = path.join(dataDir, 'empleados_google.json');
const SHEETS_API_URL = process.env.SHEETS_API_URL || '';

/**
 * POST /api/admin/sheets/sync
 * Descarga TODOS los empleados desde Google Sheets y los guarda como JSON permanente
 * en data/empleados_google.json para que esté disponible en todos lados sin depender de Google.
 * Solo se llama cuando el usuario presiona "Actualizar".
 */
export async function POST() {
  if (!SHEETS_API_URL) {
    return NextResponse.json(
      { ok: false, error: 'SHEETS_API_URL no configurada en .env.local' },
      { status: 500 }
    );
  }

  try {
    const url = new URL(SHEETS_API_URL);
    url.searchParams.set('todos', '1');

    const res = await fetch(url.toString(), { cache: 'no-store' });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Error de Google Sheets: ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();

    if (!data.ok || !Array.isArray(data.empleados)) {
      return NextResponse.json(
        { ok: false, error: data.error || 'Respuesta inesperada de Google Sheets' },
        { status: 502 }
      );
    }

    // Guardar en caché local
    await fs.mkdir(dataDir, { recursive: true });
    const cache = {
      updatedAt: new Date().toISOString(),
      total: data.empleados.length,
      empleados: data.empleados,
    };
    await fs.writeFile(cacheFilePath, JSON.stringify(cache, null, 2), 'utf-8');

    return NextResponse.json({
      ok: true,
      total: data.empleados.length,
      updatedAt: cache.updatedAt,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: `Error de conexión: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
