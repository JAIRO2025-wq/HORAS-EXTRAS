import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthContext } from '@/lib/auth-server';
import { createEmployeePfx } from '@/lib/pki';
import { saveEnrollment, getEnrollment } from '@/lib/signatures';
import type { Employee } from '@/lib/types';

const dataDir = path.join(process.cwd(), 'data');
const employeesFilePath = path.join(dataDir, 'employees.json');

// Campos personales que se sincronizan hacia employees.json.
const PERSONAL_FIELDS: (keyof Employee)[] = [
  'dui',
  'nit',
  'edad',
  'sexo',
  'nacionalidad',
  'estadoFamiliar',
  'profesion',
  'domicilio',
  'residencia',
  'lugarExpedicionDui',
  'fechaExpedicionDui',
];

async function readEmployees(): Promise<Employee[]> {
  try {
    return JSON.parse(await fs.readFile(employeesFilePath, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeEmployees(list: Employee[]): Promise<void> {
  await fs.writeFile(employeesFilePath, JSON.stringify(list, null, 2), 'utf-8');
}

/**
 * POST /api/certificados/enrolar
 * FASE 1 - Enrolamiento del empleado: genera su .pfx firmado por la CA.
 * Si `update` es true y ya existe un certificado, se regenera con los datos
 * nuevos y se actualiza la información personal del empleado.
 */
export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await request.json();
  const { dui, email, pin, update = false } = body;

  if (!dui || !email || !pin) {
    return NextResponse.json({ error: 'DUI, correo y PIN son obligatorios' }, { status: 400 });
  }

  if (!/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: 'El PIN debe tener 6 dígitos' }, { status: 400 });
  }

  if (auth.role !== 'employee') {
    return NextResponse.json({ error: 'Solo los empleados pueden enrolarse' }, { status: 403 });
  }

  const existing = await getEnrollment(auth.name);
  if (existing && !update) {
    return NextResponse.json({ error: 'Ya tienes un certificado de firma activo' }, { status: 409 });
  }

  try {
    const pfxBuffer = await createEmployeePfx({
      name: auth.name,
      dui: String(dui).trim(),
      email: String(email).trim(),
      pin: String(pin),
    });

    await saveEnrollment({
      name: auth.name,
      dui: String(dui).trim(),
      email: String(email).trim(),
      pfxBase64: pfxBuffer.toString('base64'),
      enrolledAt: existing?.enrolledAt ?? new Date().toISOString(),
      firmas: existing?.firmas ?? [],
    });

    // Sincronizar datos personales hacia employees.json.
    const employees = await readEmployees();
    const index = employees.findIndex(
      (e) => e.name?.toUpperCase() === auth.name.toUpperCase()
    );
    if (index !== -1) {
      for (const field of PERSONAL_FIELDS) {
        const value = body[field];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
          (employees[index] as Record<string, unknown>)[field] = String(value).trim();
        }
      }
      await writeEmployees(employees);
    }

    return NextResponse.json({ success: true, updated: !!existing });
  } catch (error) {
    console.error('Error en enrolamiento:', error);
    return NextResponse.json({ error: 'No se pudo generar el certificado' }, { status: 500 });
  }
}
