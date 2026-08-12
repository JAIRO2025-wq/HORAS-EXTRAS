
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { SecurityManager } from '@/lib/security';

const dataDir = path.join(process.cwd(), 'data');
const adminsFilePath = path.join(dataDir, 'admins.json');

export async function POST(request: Request) {
  try {
    const { adminId, pin } = await request.json();
    const ip = request.headers.get('x-forwarded-for') || 'unknown';

    // 1. Rate Limiting
    const rateLimit = SecurityManager.checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Bloqueado por ${rateLimit.remainingMinutes} minutos.` },
        { status: 429 }
      );
    }

    // 2. Leer admins
    const fileContent = await fs.readFile(adminsFilePath, 'utf-8');
    const admins = JSON.parse(fileContent);
    const admin = admins.find((a: any) => a.id === adminId);

    // 3. Validar
    if (admin && admin.pin === pin) {
      SecurityManager.resetAttempts(ip);

      // Generar Token Opaco
      const token = SecurityManager.createSession(admin.name, 'admin');

      const response = NextResponse.json({
        success: true,
        user: {
          name: admin.name,
          role: admin.role,
        }
      });

      response.cookies.set('admin_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 8, // 8 horas
        path: '/',
      });

      return response;
    } else {
      SecurityManager.registerFailure(ip);
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
