import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { SupervisorReport, Employee } from '@/lib/types';
import { getAuthContext } from '@/lib/auth-server';
import { months } from '@/lib/data';
import { parseISO, getDaysInMonth } from 'date-fns';
import { sendPushToUser, notifyAdmins } from '@/lib/push-server';

const dataDir = path.join(process.cwd(), 'data');
const reportsDir = path.join(dataDir, 'supervisor-reports');
const evidencesDir = path.join(dataDir, 'evidences');
const employeesFile = path.join(dataDir, 'employees.json');
const settingsFile = path.join(dataDir, 'settings.json');

type MonthlySettings = {
  quincena1_active: boolean;
  quincena2_active: boolean;
  quincena1_cutoff: number;
  quincena2_cutoff: number;
};

/**
 * Lee los empleados activos desde disco.
 */
async function readEmployees(): Promise<Employee[]> {
  try {
    const content = await fs.readFile(employeesFile, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

/**
 * Lee la configuración de quincenas de un mes contable.
 */
async function readMonthSettings(month: string): Promise<MonthlySettings> {
  const monthIndex = months.indexOf(month);
  const year = new Date().getFullYear();
  const lastDay = getDaysInMonth(new Date(year, monthIndex));

  const fallback: MonthlySettings = {
    quincena1_active: true,
    quincena2_active: true,
    quincena1_cutoff: 15,
    quincena2_cutoff: lastDay,
  };

  try {
    const content = await fs.readFile(settingsFile, 'utf-8');
    const all = JSON.parse(content);
    return all[month] || fallback;
  } catch (e) {
    return fallback;
  }
}

/**
 * Determina si una fecha (yyyy-MM-dd) cae dentro de una quincena ACTIVA.
 * Devuelve la quincena (1|2) o null si la quincena está cerrada.
 */
function resolveActiveQuincena(
  absenceDate: string,
  month: string,
  settings: MonthlySettings
): 1 | 2 | null {
  const date = parseISO(absenceDate);
  if (isNaN(date.getTime())) return null;

  const monthIndex = months.indexOf(month);
  if (monthIndex === -1) return null;

  // La fecha debe pertenecer al mes contable seleccionado
  if (date.getMonth() !== monthIndex) return null;

  const dom = date.getDate();
  if (dom <= settings.quincena1_cutoff) {
    return settings.quincena1_active ? 1 : null;
  }
  if (dom <= settings.quincena2_cutoff) {
    return settings.quincena2_active ? 2 : null;
  }
  return null;
}

/**
 * Ruta del archivo por quincena: data/supervisor-reports/[AÑO]/[MES]/[Q1|Q2].json
 * Misma estructura jerárquica que los registros de horas extra.
 */
async function getReportPath(month: string, quincena: 1 | 2) {
  const year = new Date().getFullYear().toString();
  const targetDir = path.join(reportsDir, year, month);
  await fs.mkdir(targetDir, { recursive: true });
  return path.join(targetDir, `Q${quincena}.json`);
}

/**
 * Lee todos los reportes recorriendo la estructura jerárquica
 * data/supervisor-reports/[AÑO]/[MES]/[Q1|Q2].json
 */
async function readAllReports(): Promise<SupervisorReport[]> {
  let all: SupervisorReport[] = [];
  try {
    const years = await fs.readdir(reportsDir).catch(() => []);
    for (const year of years) {
      const yearDir = path.join(reportsDir, year);
      const yearStat = await fs.stat(yearDir).catch(() => null);
      if (!yearStat || !yearStat.isDirectory()) continue;

      const monthsOnDisk = await fs.readdir(yearDir).catch(() => []);
      for (const monthEntry of monthsOnDisk) {
        const monthPath = path.join(yearDir, monthEntry);
        const monthStat = await fs.stat(monthPath).catch(() => null);

        // Estructura nueva: [AÑO]/[MES]/[Q1|Q2].json
        if (monthStat && monthStat.isDirectory()) {
          const qFiles = await fs.readdir(monthPath).catch(() => []);
          for (const qFile of qFiles) {
            if (!qFile.toLowerCase().endsWith('.json')) continue;
            try {
              const content = await fs.readFile(path.join(monthPath, qFile), 'utf-8');
              const data = JSON.parse(content);
              if (Array.isArray(data)) all = [...all, ...data];
            } catch (e) {}
          }
        } else if (monthEntry.toLowerCase().endsWith('.json')) {
          // Compatibilidad con la estructura anterior: [AÑO]/[MES].json
          try {
            const content = await fs.readFile(monthPath, 'utf-8');
            const data = JSON.parse(content);
            if (Array.isArray(data)) all = [...all, ...data];
          } catch (e) {}
        }
      }
    }
  } catch (e) {
    console.error('Error leyendo reportes de jefes:', e);
  }
  return all;
}

async function sendPush(targetName: string, title: string, message: string, url: string) {
  await sendPushToUser(targetName, title, message, url);
}

export async function GET(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const selectedMonth = searchParams.get('month');
  const selectedQuincena = searchParams.get('quincena');

  let reports = await readAllReports();

  if (auth.role === 'admin') {
    if (selectedMonth) {
      reports = reports.filter(r => {
        const d = parseISO(r.absenceDate);
        return !isNaN(d.getTime()) && months[d.getMonth()] === selectedMonth;
      });
    }
    if (selectedQuincena === '1' || selectedQuincena === '2') {
      reports = reports.filter(r => r.quincena === Number(selectedQuincena));
    }
  } else {
    // Un jefe solo ve los reportes que él mismo emitió
    const sessionName = auth.name.toUpperCase().trim();
    reports = reports.filter(r => (r.supervisorName || '').toUpperCase().trim() === sessionName);
  }

  reports.sort((a, b) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime());
  return NextResponse.json(reports);
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { employeeName, absenceDate, reason, justification, evidenceFileDataUri, month } = body;

    if (!employeeName || !absenceDate || !reason || !justification) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // 1. Validar que quien reporta sea un jefe/supervisor activo
    const employees = await readEmployees();
    const sessionName = auth.name.toUpperCase().trim();
    const me = employees.find(e => (e.name || '').toUpperCase().trim() === sessionName);

    if (!me || me.isSupervisor !== true) {
      return NextResponse.json({ error: 'Solo los jefes de agencia pueden emitir reportes' }, { status: 403 });
    }

    // 2. Validar que el colaborador reportado pertenezca a la misma sucursal
    const target = employees.find(e => (e.name || '').toUpperCase().trim() === employeeName.toUpperCase().trim());
    if (!target) {
      return NextResponse.json({ error: 'Colaborador no encontrado' }, { status: 404 });
    }
    if (target.branch !== me.branch) {
      return NextResponse.json({ error: 'Solo puedes reportar colaboradores de tu sucursal' }, { status: 403 });
    }
    if (target.name.toUpperCase().trim() === sessionName) {
      return NextResponse.json({ error: 'No puedes reportarte a ti mismo' }, { status: 400 });
    }

    // 3. Validar que la fecha caiga en una quincena ACTIVA del mes contable
    const accountingMonth = month || months[new Date().getMonth()];
    const settings = await readMonthSettings(accountingMonth);
    const quincena = resolveActiveQuincena(absenceDate, accountingMonth, settings);

    if (!quincena) {
      return NextResponse.json(
        { error: 'La fecha no pertenece a una quincena activa del periodo seleccionado.' },
        { status: 400 }
      );
    }

    // 4. Evitar duplicados: mismo colaborador + misma fecha
    const existing = await readAllReports();
    const duplicate = existing.find(r =>
      (r.employeeName || '').toUpperCase().trim() === target.name.toUpperCase().trim() &&
      r.absenceDate === absenceDate
    );
    if (duplicate) {
      return NextResponse.json({ error: 'Ya existe un reporte para este colaborador en esa fecha' }, { status: 409 });
    }

    const reportId = crypto.randomUUID();
    let finalEvidenceUri = evidenceFileDataUri;

    // 5. Guardar evidencia (imagen o PDF) en data/evidences
    if (evidenceFileDataUri && evidenceFileDataUri.startsWith('data:')) {
      try {
        const [meta, base64Data] = evidenceFileDataUri.split(';base64,');
        const mimeType = meta.split(':')[1];
        const isPdf = mimeType.includes('pdf');
        const extension = isPdf ? 'pdf'
          : mimeType.includes('png') ? 'png'
          : mimeType.includes('webp') ? 'webp' : 'jpg';

        await fs.mkdir(evidencesDir, { recursive: true });
        await fs.writeFile(path.join(evidencesDir, `${reportId}.${extension}`), Buffer.from(base64Data, 'base64'));

        finalEvidenceUri = `/api/supervisor-reports/evidence?id=${reportId}&type=${isPdf ? 'pdf' : 'image'}`;
      } catch (fileError) {
        console.error('Error saving report evidence:', fileError);
      }
    }

    const report: SupervisorReport = {
      id: reportId,
      reportDate: new Date().toISOString(),
      supervisorName: me.name,
      branch: me.branch,
      employeeName: target.name,
      employeePosition: target.position,
      absenceDate,
      quincena,
      reason,
      justification,
      status: 'pending',
      evidenceFileDataUri: finalEvidenceUri,
    };

    const filePath = await getReportPath(accountingMonth, quincena);
    let reports: SupervisorReport[] = [];
    try {
      reports = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    } catch (e) {}
    reports.push(report);
    await fs.writeFile(filePath, JSON.stringify(reports, null, 2));

    const title = 'Reporte de Inasistencia';
    const message = `${me.name} reportó la ausencia de ${target.name}.`;
    await notifyAdmins(title, message);

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error creando reporte de jefe:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await getAuthContext();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, status, adminNotes } = await request.json();
    if (!id || !status) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    const years = await fs.readdir(reportsDir).catch(() => []);
    let foundFile: string | null = null;
    let reports: SupervisorReport[] = [];
    let idx = -1;

    for (const year of years) {
      const yearDir = path.join(reportsDir, year);
      const yearStat = await fs.stat(yearDir).catch(() => null);
      if (!yearStat || !yearStat.isDirectory()) continue;

      const monthEntries = await fs.readdir(yearDir).catch(() => []);
      for (const monthEntry of monthEntries) {
        const monthPath = path.join(yearDir, monthEntry);
        const monthStat = await fs.stat(monthPath).catch(() => null);

        // Estructura nueva: [AÑO]/[MES]/[Q1|Q2].json
        const candidateFiles: string[] = [];
        if (monthStat && monthStat.isDirectory()) {
          const qFiles = await fs.readdir(monthPath).catch(() => []);
          for (const qFile of qFiles) {
            if (qFile.toLowerCase().endsWith('.json')) candidateFiles.push(path.join(monthPath, qFile));
          }
        } else if (monthEntry.toLowerCase().endsWith('.json')) {
          // Compatibilidad con la estructura anterior: [AÑO]/[MES].json
          candidateFiles.push(monthPath);
        }

        for (const filePath of candidateFiles) {
          try {
            const data: SupervisorReport[] = JSON.parse(await fs.readFile(filePath, 'utf-8'));
            const findIdx = data.findIndex(r => r.id === id);
            if (findIdx !== -1) {
              foundFile = filePath;
              reports = data;
              idx = findIdx;
              break;
            }
          } catch (e) {}
        }
        if (foundFile) break;
      }
      if (foundFile) break;
    }

    if (idx === -1 || !foundFile) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    reports[idx].status = status;
    reports[idx].adminNotes = adminNotes || '';
    reports[idx].reviewedAt = new Date().toISOString();
    reports[idx].reviewedBy = auth.name;

    await fs.writeFile(foundFile, JSON.stringify(reports, null, 2));

    await sendPush(
      reports[idx].supervisorName,
      'Reporte Revisado',
      `Tu reporte sobre ${reports[idx].employeeName} fue ${status === 'reviewed' ? 'revisado' : 'descartado'} por administración.`,
      '/dashboard?tab=supervisor-reports'
    );

    return NextResponse.json(reports[idx]);
  } catch (error) {
    console.error('Error actualizando reporte de jefe:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
