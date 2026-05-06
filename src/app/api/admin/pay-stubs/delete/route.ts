import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');

export async function DELETE(request: Request) {
  try {
    const { year, month, quincena, employeeName } = await request.json();

    if (!year || !month || !quincena || !employeeName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const cleanName = employeeName.replace(/[^a-z0-9]/gi, '_').toUpperCase();
    const filePath = path.join(dataDir, 'pay-stubs', year, month, `Q${quincena}`, `${cleanName}.pdf`);

    await fs.unlink(filePath);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting pay stub:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
