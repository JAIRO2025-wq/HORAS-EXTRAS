
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { SecurityManager } from '@/lib/security';

const dataDir = path.join(process.cwd(), 'data');
const employeesFilePath = path.join(dataDir, 'employees.json');
const adminsFilePath = path.join(dataDir, 'admins.json');

export async function POST(request: Request) {
  try {
    const { pin, month } = await request.json();
    const ip = request.headers.get('x-forwarded-for') || 'unknown';

    // 1. Rate Limiting (Anti-Brute Force)
    const rateLimit = SecurityManager.checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Demasiados intentos. Bloqueado por ${rateLimit.remainingMinutes} minutos.` },
        { status: 429 }
      );
    }

    if (!pin) {
      return NextResponse.json({ error: 'PIN requerido' }, { status: 400 });
    }

    // 2. Buscar en ADMINS primero
    const adminsContent = await fs.readFile(adminsFilePath, 'utf-8');
    const admins = JSON.parse(adminsContent);
    const admin = admins.find((a: any) => a.pin === pin);

    if (admin) {
      SecurityManager.resetAttempts(ip);
      const token = SecurityManager.createSession(admin.name, 'admin');
      
      const response = NextResponse.json({
        success: true,
        type: 'admin',
        user: { name: admin.name, role: admin.role }
      });

      response.cookies.set('admin_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 8, // 8 horas
        path: '/',
      });

      return response;
    }

    // 3. Si no es admin, buscar en EMPLEADOS
    const employeesContent = await fs.readFile(employeesFilePath, 'utf-8');
    const employees = JSON.parse(employeesContent);
    const employee = employees.find((e: any) => e.pin === pin && e.status === 'active');

    if (employee) {
      SecurityManager.resetAttempts(ip);
      const token = SecurityManager.createSession(employee.name, 'employee');

      const response = NextResponse.json({
        success: true,
        type: 'employee',
        user: { name: employee.name }
      });

      response.cookies.set('employee_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 12, // 12 horas
        path: '/',
      });

      return response;
    }

    // 4. Si no se encuentra en ninguno
    SecurityManager.registerFailure(ip);
    return NextResponse.json({ error: 'PIN no reconocido o usuario inactivo' }, { status: 401 });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
