import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string; // 'contract_signed', 'confidentiality_signed', 'salary_certificate'

    if (!file || !type) {
      return NextResponse.json({ error: 'Faltan archivo o tipo' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const outputDir = path.join(process.cwd(), 'public', 'uploads', 'contratos');
    await fs.mkdir(outputDir, { recursive: true });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${type}_${Date.now()}_${safeName}`;
    const outputPath = path.join(outputDir, fileName);
    await fs.writeFile(outputPath, buffer);

    const publicUrl = `/uploads/contratos/${fileName}`;

    return NextResponse.json({ url: publicUrl, fileName });
  } catch (error) {
    console.error('Error subiendo archivo:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
