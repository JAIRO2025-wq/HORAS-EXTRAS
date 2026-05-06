import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const quincena = searchParams.get('quincena');
  const employee = searchParams.get('employee');

  if (!year || !month || !quincena || !employee) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // El nombre del empleado viene con espacios, en el server está con guiones bajos
  const cleanName = employee.replace(/[^a-z0-9]/gi, '_').toUpperCase();
  const filePath = path.join(dataDir, 'pay-stubs', year, month, `Q${quincena}`, `${cleanName}.pdf`);

  try {
    const fileBuffer = await fs.readFile(filePath);
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${cleanName}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
