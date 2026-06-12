import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthContext } from '@/lib/auth-server';

const historyDocsDir = path.join(process.cwd(), 'data', 'history_docs');

export async function GET(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return new Response('Unauthorized', { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return new Response('Missing ID', { status: 400 });

  try {
    const files = await fs.readdir(historyDocsDir);
    const fileName = files.find(f => f.startsWith(id));

    if (!fileName) return new Response('Not found', { status: 404 });

    const filePath = path.join(historyDocsDir, fileName);
    const fileBuffer = await fs.readFile(filePath);
    const extension = path.extname(fileName).toLowerCase();

    let contentType = 'application/octet-stream';
    if (extension === '.pdf') contentType = 'application/pdf';
    else if (['.jpg', '.jpeg'].includes(extension)) contentType = 'image/jpeg';
    else if (extension === '.png') contentType = 'image/png';

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    return new Response('Error reading file', { status: 500 });
  }
}
