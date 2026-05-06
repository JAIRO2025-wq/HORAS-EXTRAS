import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthContext } from '@/lib/auth-server';

const dataDir = path.join(process.cwd(), 'data');

export async function GET(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const quincena = searchParams.get('quincena');
  const requestedUser = searchParams.get('user');

  if (!year || !month || !quincena || !requestedUser) {
    return NextResponse.json({ error: 'Parámetros incompletos' }, { status: 400 });
  }

  const isOwner = auth.role === 'employee' && auth.name === requestedUser;
  const isAdmin = auth.role === 'admin';

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'No tienes permiso para ver este archivo' }, { status: 403 });
  }

  const sUser = requestedUser.replace(/[^a-z0-9]/gi, '_').toUpperCase();
  const folderPath = path.join(dataDir, 'pay-stubs', year, month, `Q${quincena}`);

  try {
    const files = await fs.readdir(folderPath);
    const match = files.find(f => {
        const fUpper = f.toUpperCase().replace('.PDF', '');
        return sUser.includes(fUpper) || fUpper.includes(sUser);
    });

    if (!match) throw new Error('Not found');

    const fileBuffer = await fs.readFile(path.join(folderPath, match));
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Recibo_${month}_Q${quincena}.pdf"`,
        'Cache-Control': 'no-store, max-age=0'
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
  }
}
