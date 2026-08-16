import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthContext } from '@/lib/auth-server';
import type { Employee } from '@/lib/types';
import { readSignatures, normalizeName, type EnrollmentRecord } from '@/lib/signatures';

const dataDir = path.join(process.cwd(), 'data');
const employeesFile = path.join(dataDir, 'employees.json');

/**
 * GET /api/admin/firmas/estado?year=&month=&quincena=
 * Control de firmas: quién tiene recibo, quién está enrolado y quién ya firmó.
 */
export async function GET(request: Request) {
  const auth = await getAuthContext();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const quincena = searchParams.get('quincena');

  if (!year || !month || !quincena) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const stubFolder = path.join(dataDir, 'pay-stubs', year, month, `Q${quincena}`);

  const [employees, store, stubs] = await Promise.all([
    fs
      .readFile(employeesFile, 'utf-8')
      .then((c) => JSON.parse(c) as Employee[])
      .catch(() => [] as Employee[]),
    readSignatures(),
    fs.readdir(stubFolder).catch(() => [] as string[]),
  ]);

  const stubKeys = new Set(
    stubs.filter((f) => f.toLowerCase().endsWith('.pdf')).map((f) => f.replace(/\.pdf$/i, '').toUpperCase())
  );

  const rows = employees
    .filter((e) => e.status === 'active')
    .map((emp) => {
      const key = normalizeName(emp.name);
      const enrollment: EnrollmentRecord | undefined = store[key];
      const firma = (enrollment?.firmas || []).find(
        (f) => f.year === Number(year) && f.month === month && f.quincena === Number(quincena)
      );

      return {
        id: emp.id,
        name: emp.name,
        branch: emp.branch,
        email: enrollment?.email ?? null,
        enrolled: !!enrollment,
        hasReceipt: stubKeys.has(key),
        signed: !!firma,
        signedAt: firma?.signedAt ?? null,
        rubricaPath: firma?.rubricaPath ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const summary = {
    total: rows.length,
    conRecibo: rows.filter((r) => r.hasReceipt).length,
    enrolados: rows.filter((r) => r.enrolled).length,
    firmados: rows.filter((r) => r.signed).length,
    pendientes: rows.filter((r) => r.hasReceipt && !r.signed).length,
  };

  return NextResponse.json({ rows, summary });
}
