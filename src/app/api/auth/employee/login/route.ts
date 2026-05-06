
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { Employee } from '@/lib/types';
import { SecurityManager } from '@/lib/security';

const dataDir = path.join(process.cwd(), 'data');
const employeesFilePath = path.join(dataDir, 'employees.json');

export async function POST(request: Request) {
  try {
    const { employeeId, pin } = await request.json();
    const ip = request.headers.get('x-forwarded-for') || 'unknown';

    // 1. Rate Limiting (Anti-Brute Force)
    const rateLimit = SecurityManager.checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Demasiados intentos. Bloqueado por ${rateLimit.remainingMinutes} minutos.` },
        { status: 429 }
      );
    }

    if (!employeeId || !pin) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    // 2. Leer empleados
    const fileContent = await fs.readFile(employeesFilePath, 'utf-8');
    const employees: Employee[] = JSON.parse(fileContent);
    const employee = employees.find(e => e.id.toString() === employeeId && e.status === 'active');

    // 3. Validar PIN
    if (employee && employee.pin === pin) {
      SecurityManager.resetAttempts(ip);

      // Crear sesión con Token Opaco
      const token = SecurityManager.createSession(employee.name, 'employee');

      const response = NextResponse.json({
        success: true,
        user: { name: employee.name }
      });

      // Cookie segura (invisible para JS)
      response.cookies.set('employee_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 12,
        path: '/',
      });

      return response;
    } else {
      SecurityManager.registerFailure(ip);
      return NextResponse.json({ error: 'PIN incorrecto o empleado inactivo' }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}
