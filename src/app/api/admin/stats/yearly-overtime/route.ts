
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { months } from '@/lib/data';
import { getAuthContext } from '@/lib/auth-server';

const dataDir = path.join(process.cwd(), 'data');

/**
 * Lee recursivamente todos los JSON dentro de una carpeta.
 */
async function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await getAllFiles(fullPath, arrayOfFiles);
      } else if (entry.name.toLowerCase().endsWith('.json')) {
        arrayOfFiles.push(fullPath);
      }
    }
  } catch (e) {}
  return arrayOfFiles;
}

/**
 * Acumula las horas aprobadas de un arreglo de registros en el mes indicado.
 */
function accumulate(records: any, month: string, stats: Record<string, { day: number; night: number }>) {
  if (!Array.isArray(records) || !stats[month]) return;
  records.forEach((rec: any) => {
    if (rec.status === 'approved') {
      stats[month].day += (rec.dayHours || 0);
      stats[month].night += (rec.nightHours || 0);
    }
  });
}

export async function GET() {
  const auth = await getAuthContext();
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const files = await fs.readdir(dataDir);
    const currentYear = new Date().getFullYear();
    
    // Inicializar mapa de meses con desglose
    const stats: Record<string, { day: number; night: number }> = {};
    months.forEach(m => { 
      stats[m] = { day: 0, night: 0 }; 
    });

    const excludedFiles = [
        'BRANCHES.JSON', 'EMPLOYEES.JSON', 'SETTINGS.JSON', 
        'ADMINS.JSON', 'VAPID.JSON', 'PUSH_SUBSCRIPTIONS.JSON', 
        'USER_NOTIFICATIONS.JSON', 'EMPLOYEE_COUNTER.JSON', 
        'PERMITS.JSON', 'NOTIFICATIONS_CONFIRM.JSON'
    ];

    // 1. Estructura jerárquica: data/records/[AÑO]/[MES]/[Q1|Q2]/[NOMBRE].json
    const recordsRoot = path.join(dataDir, 'records');
    const hierarchicalFiles = await getAllFiles(recordsRoot);
    for (const filePath of hierarchicalFiles) {
      try {
        // El mes es el nombre de la carpeta contenedora (ej. .../2026/JUNIO/Q2/NOMBRE.json)
        const monthFolder = path.basename(path.dirname(path.dirname(filePath)));
        const fileMonth = months.find(m => m.toUpperCase() === monthFolder.toUpperCase());
        if (!fileMonth) continue;

        const content = await fs.readFile(filePath, 'utf-8');
        accumulate(JSON.parse(content), fileMonth, stats);
      } catch (e) {
        console.error(`Error procesando archivo ${filePath}:`, e);
      }
    }

    // 2. Estructura legacy (flat): data/[NOMBRE]-[MES].json
    const recordFiles = files.filter(f => {
        const fUpper = f.toUpperCase();
        return f.endsWith('.json') && 
               !f.startsWith('attendance-') && 
               !excludedFiles.includes(fUpper);
    });

    for (const file of recordFiles) {
      try {
        // Extraer el mes del nombre del archivo (Mes Contable)
        // El formato es NOMBRE-MES.json (puede llevar sufijo "(1)")
        const base = file.replace(/\.json$/i, '').replace(/\(\d+\)$/, '');
        const parts = base.split('-');
        const fileMonthRaw = parts[parts.length - 1];
        
        // Normalizar el nombre del mes para que coincida con nuestro array 'months'
        const fileMonth = months.find(m => m.toLowerCase() === fileMonthRaw.toLowerCase());
        
        if (!fileMonth) continue;

        const content = await fs.readFile(path.join(dataDir, file), 'utf-8');
        accumulate(JSON.parse(content), fileMonth, stats);
      } catch (e) {
        console.error(`Error procesando archivo ${file}:`, e);
      }
    }

    // Formatear para el componente de gráfica
    const chartData = months.map(m => ({
      month: m.substring(0, 3),
      day: parseFloat(stats[m].day.toFixed(1)),
      night: parseFloat(stats[m].night.toFixed(1)),
      total: parseFloat((stats[m].day + stats[m].night).toFixed(1))
    }));

    return NextResponse.json({
      year: currentYear,
      data: chartData
    });

  } catch (error) {
    console.error('Error generando estadísticas anuales:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
