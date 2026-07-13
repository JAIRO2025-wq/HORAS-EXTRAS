
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { SecurityManager } from '@/lib/security';

const dataDir = path.join(process.cwd(), 'data');
const adminsFilePath = path.join(dataDir, 'admins.json');

async function ensureDataDir() {
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

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
    await ensureDataDir();
    let admins: any[];
    try {
      const fileContent = await fs.readFile(adminsFilePath, 'utf-8');
      admins = JSON.parse(fileContent);
    } catch {
      admins = [
        { id: '1', name: 'Admin Control', pin: '2026', role: 'ADMIN_1' },
        { id: '2', name: 'Admin Gerencia', pin: '7777', role: 'ADMIN_2' }
      ];
      await fs.writeFile(adminsFilePath, JSON.stringify(admins, null, 2));
    }
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
