import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-server';
import { getEnrollment } from '@/lib/signatures';
import { generateOtp } from '@/lib/otp';
import { sendOtpEmail } from '@/lib/mailer';

/**
 * POST /api/otp/solicitar
 * FASE 2 - Genera y envía el código OTP al correo del empleado.
 */
export async function POST() {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const enrollment = await getEnrollment(auth.name);
  if (!enrollment) {
    return NextResponse.json({ error: 'Primero debes activar tu firma digital' }, { status: 400 });
  }

  const code = generateOtp(enrollment.email);
  const { delivered } = await sendOtpEmail(enrollment.email, code);

  const response: Record<string, unknown> = { success: true, delivered };
  if (!delivered && process.env.NODE_ENV !== 'production') {
    response.devCode = code;
  }

  return NextResponse.json(response);
}
