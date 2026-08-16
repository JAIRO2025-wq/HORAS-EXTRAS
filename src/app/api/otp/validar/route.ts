import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-server';
import { getEnrollment } from '@/lib/signatures';
import { validateOtp } from '@/lib/otp';

/**
 * POST /api/otp/validar
 * FASE 2 - Valida el código OTP (un solo uso, expira en 5 min).
 */
export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const enrollment = await getEnrollment(auth.name);
  if (!enrollment) {
    return NextResponse.json({ error: 'Primero debes activar tu firma digital' }, { status: 400 });
  }

  const { code } = await request.json();
  if (!code) {
    return NextResponse.json({ error: 'Código requerido' }, { status: 400 });
  }

  const valid = validateOtp(enrollment.email, String(code));
  return NextResponse.json({ valid });
}
