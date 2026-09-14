import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthContext } from '@/lib/auth-server';

const evidencesDir = path.join(process.cwd(), 'data', 'evidences');

/**
 * Sirve los archivos de evidencia (imagen o PDF) adjuntos a los reportes de jefes.
 */
export async function GET(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return new Response('No autorizado', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('ID de evidencia requerido', { status: 400 });
  }

  try {
    const files = await fs.readdir(evidencesDir);
    const fileName = files.find(f => f.startsWith(id));

    if (!fileName) {
      return new Response('Archivo no encontrado', { status: 404 });
    }

    const fileBuffer = await fs.readFile(path.join(evidencesDir, fileName));
    const extension = path.extname(fileName).toLowerCase();

    let contentType = 'application/octet-stream';
    if (extension === '.pdf') contentType = 'application/pdf';
    else if (extension === '.jpg' || extension === '.jpeg') contentType = 'image/jpeg';
    else if (extension === '.png') contentType = 'image/png';
    else if (extension === '.webp') contentType = 'image/webp';

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error serving report evidence:', error);
    return new Response('Error al leer el archivo', { status: 500 });
  }
}
