import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthContext } from '@/lib/auth-server';

const evidencesDir = path.join(process.cwd(), 'data', 'evidences');

/**
 * API para servir los archivos de evidencia (justificantes) de forma segura y eficiente.
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
    // Listar archivos para encontrar el que coincida con el ID (independientemente de la extensión)
    const files = await fs.readdir(evidencesDir);
    const fileName = files.find(f => f.startsWith(id));

    if (!fileName) {
      return new Response('Archivo no encontrado', { status: 404 });
    }

    const filePath = path.join(evidencesDir, fileName);
    const fileBuffer = await fs.readFile(filePath);
    const extension = path.extname(fileName).toLowerCase();

    // Determinar el Content-Type correcto
    let contentType = 'application/octet-stream';
    if (extension === '.pdf') contentType = 'application/pdf';
    else if (extension === '.jpg' || extension === '.jpeg') contentType = 'image/jpeg';
    else if (extension === '.png') contentType = 'image/png';
    else if (extension === '.webp') contentType = 'image/webp';

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600', // Cache por 1 hora para el navegador
      },
    });
  } catch (error) {
    console.error("Error serving evidence file:", error);
    return new Response('Error al leer el archivo', { status: 500 });
  }
}
