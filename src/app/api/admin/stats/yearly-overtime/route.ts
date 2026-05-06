
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { months } from '@/lib/data';
import { getAuthContext } from '@/lib/auth-server';

const dataDir = path.join(process.cwd(), 'data');

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

    const recordFiles = files.filter(f => {
        const fUpper = f.toUpperCase();
        return f.endsWith('.json') && 
               !f.startsWith('attendance-') && 
               !excludedFiles.includes(fUpper);
    });

    for (const file of recordFiles) {
      try {
        // Extraer el mes del nombre del archivo (Mes Contable)
        // El formato es NOMBRE-MES.json
        const parts = file.split('-');
        const fileMonthRaw = parts[parts.length - 1].replace('.json', '');
        
        // Normalizar el nombre del mes para que coincida con nuestro array 'months'
        const fileMonth = months.find(m => m.toLowerCase() === fileMonthRaw.toLowerCase());
        
        if (!fileMonth) continue;

        const content = await fs.readFile(path.join(dataDir, file), 'utf-8');
        const records = JSON.parse(content);
        
        if (Array.isArray(records)) {
          records.forEach((rec: any) => {
            // Solo contar registros aprobados
            if (rec.status === 'approved') {
              // Sumar al mes del archivo (Nómina) para que coincida con los reportes
              stats[fileMonth].day += (rec.dayHours || 0);
              stats[fileMonth].night += (rec.nightHours || 0);
            }
          });
        }
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
