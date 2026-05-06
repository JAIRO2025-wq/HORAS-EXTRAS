import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { months } from '@/lib/data';
import { getAuthContext } from '@/lib/auth-server';

const dataDir = path.join(process.cwd(), 'data');

export async function GET(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const user = auth.role === 'admin' ? (searchParams.get('user') || auth.name) : auth.name;

  if (!user) {
    return NextResponse.json({ error: 'Identidad no encontrada' }, { status: 400 });
  }

  const sUser = user.replace(/[^a-z0-9]/gi, '_').toUpperCase();
  const foundStubs = [];
  
  const now = new Date();
  let currentYear = now.getFullYear();
  let currentMonthIndex = now.getMonth();

  for (let m = 0; m < 6 && foundStubs.length < 6; m++) {
    const monthName = months[currentMonthIndex];
    
    for (let q = 2; q >= 1 && foundStubs.length < 6; q--) {
      const folderPath = path.join(dataDir, 'pay-stubs', currentYear.toString(), monthName, `Q${q}`);
      
      try {
        const files = await fs.readdir(folderPath);
        // Buscamos si existe el archivo exacto o uno que contenga el nombre del usuario
        // Esto permite que si el archivo se llama JAIRO_GUEVARA.pdf y el usuario es JAIRO ANTONIO GUEVARA HERNANDEZ, lo encuentre
        const match = files.find(f => {
            const fUpper = f.toUpperCase().replace('.PDF', '');
            return sUser.includes(fUpper) || fUpper.includes(sUser);
        });

        if (match) {
          foundStubs.push({
            year: currentYear,
            month: monthName,
            quincena: q,
            fileName: `Recibo_${monthName}_Q${q}.pdf`,
            viewUrl: `/api/pay-stubs/view?year=${currentYear}&month=${monthName}&quincena=${q}&user=${encodeURIComponent(user)}`
          });
        }
      } catch (e) {}
    }

    currentMonthIndex--;
    if (currentMonthIndex < 0) {
      currentMonthIndex = 11;
      currentYear--;
    }
  }

  return NextResponse.json(foundStubs);
}
