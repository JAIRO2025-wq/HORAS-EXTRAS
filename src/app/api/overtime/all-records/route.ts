
import { NextResponse } from 'next/server';

/**
 * @deprecated Este endpoint se movió a /api/admin/all-records por seguridad.
 * El middleware bloquea el acceso si no eres admin.
 */
export async function GET() {
    return NextResponse.json({ error: 'Endpoint moved to secure admin area' }, { status: 403 });
}
