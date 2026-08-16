import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthContext } from '@/lib/auth-server';
import { getEnrollment, recordSignature, saveRubrica, normalizeName } from '@/lib/signatures';
import { validateOtp } from '@/lib/otp';
import { signEmployeePdf } from '@/lib/sign-pdf';

const dataDir = path.join(process.cwd(), 'data');

async function findPayStubFile(name: string, year: string, month: string, quincena: string): Promise<string | null> {
  const folderPath = path.join(dataDir, 'pay-stubs', year, month, `Q${quincena}`);
  const sUser = normalizeName(name);
  try {
    const files = await fs.readdir(folderPath);
    const match = files.find(f => {
      const fUpper = f.toUpperCase().replace('.PDF', '');
      return sUser.includes(fUpper) || fUpper.includes(sUser);
    });
    return match ? path.join(folderPath, match) : null;
  } catch (error) {
    return null;
  }
}

/**
 * POST /api/firmas/firmar
 * FASE 3 - Aplica la Firma 2 (Empleado) al recibo, validando OTP + PIN.
 */
export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (auth.role !== 'employee') {
    return NextResponse.json({ error: 'Solo los empleados pueden firmar' }, { status: 403 });
  }

  const { year, month, quincena, pin, otp, rubricaDataUri } = await request.json();

  if (!year || !month || !quincena || !pin || !otp) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  const enrollment = await getEnrollment(auth.name);
  if (!enrollment) {
    return NextResponse.json({ error: 'Primero debes activar tu firma digital' }, { status: 400 });
  }

  const yaFirmado = (enrollment.firmas || []).some(
    f => f.year === Number(year) && f.month === month && f.quincena === Number(quincena)
  );
  if (yaFirmado) {
    return NextResponse.json({ error: 'Este recibo ya fue firmado' }, { status: 409 });
  }

  // 1. Validar OTP (prueba de voluntad).
  if (!validateOtp(enrollment.email, String(otp))) {
    return NextResponse.json({ error: 'OTP inválido o vencido' }, { status: 401 });
  }

  // 2. Localizar el recibo.
  const filePath = await findPayStubFile(auth.name, String(year), String(month), String(quincena));
  if (!filePath) {
    return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
  }

  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  try {
    // 3. Firmar con el .pfx del empleado (desbloqueado por su PIN).
    const pdfBuffer = await fs.readFile(filePath);
    const signedPdf = await signEmployeePdf(pdfBuffer, enrollment, String(pin), {
      ip,
      otpCode: String(otp),
    });

    await fs.writeFile(filePath, signedPdf);

    // 4. Guardar la rúbrica (evidencia visual) si fue enviada.
    let rubricaPath: string | undefined;
    if (rubricaDataUri) {
      const fileName = `rubrica-${year}-${month}-Q${quincena}.png`;
      rubricaPath = await saveRubrica(auth.name, fileName, rubricaDataUri);
    }

    // 5. Registrar metadatos de la firma.
    await recordSignature(auth.name, {
      year: Number(year),
      month: String(month),
      quincena: Number(quincena),
      fileName: path.basename(filePath),
      signedAt: new Date().toISOString(),
      ip,
      otpCode: String(otp),
      rubricaPath,
    });

    return NextResponse.json({ success: true, fileName: path.basename(filePath) });
  } catch (error) {
    console.error('Error firmando recibo:', error);
    return NextResponse.json({ error: 'PIN incorrecto o no se pudo firmar el recibo' }, { status: 401 });
  }
}
