import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-server';
import { getEnrollment } from '@/lib/signatures';

/**
 * GET /api/certificados/estado
 * Devuelve el estado de enrolamiento del usuario autenticado (sin el .pfx).
 */
export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const record = await getEnrollment(auth.name);

  if (!record) {
    return NextResponse.json({ enrolled: false });
  }

  return NextResponse.json({
    enrolled: true,
    name: record.name,
    dui: record.dui,
    email: record.email,
    enrolledAt: record.enrolledAt,
    firmas: record.firmas,
  });
}
