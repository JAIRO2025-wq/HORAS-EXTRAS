import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const cacheFilePath = path.join(dataDir, 'empleados_google.json');

/**
 * Lee el archivo JSON permanente data/empleados_google.json (datos descargados de Google Sheets).
 * Si no existe el archivo, devuelve vacío (el frontend pedirá presionar "Actualizar").
 */
async function readCache(): Promise<{ updatedAt: string | null; empleados: any[] }> {
  try {
    const content = await fs.readFile(cacheFilePath, 'utf-8');
    const data = JSON.parse(content);
    return {
      updatedAt: data.updatedAt || null,
      empleados: Array.isArray(data.empleados) ? data.empleados : [],
    };
  } catch {
    return { updatedAt: null, empleados: [] };
  }
}

/**
 * Calcula la edad a partir de cualquier formato de fecha:
 * - "Sat Nov 16 1996 02:00:00 GMT-0600" (Date string de Google)
 * - "16/11/1996"
 * - "16 de noviembre de 1996"
 */
function calcularEdad(valorFecha: any): string {
  if (!valorFecha) return '';
  const texto = String(valorFecha).trim();
  if (!texto) return '';

  let fechaNac: Date | null = null;

  // Formato "16 de noviembre de 1996"
  const matchTexto = texto.match(/^(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})$/i);
  if (matchTexto) {
    const meses: Record<string, number> = {
      enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
      julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
    };
    const mes = meses[matchTexto[2].toLowerCase()];
    if (mes !== undefined) {
      fechaNac = new Date(parseInt(matchTexto[3]), mes, parseInt(matchTexto[1]));
    }
  } else {
    // Formato "DD/MM/YYYY"
    const matchNum = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (matchNum) {
      fechaNac = new Date(parseInt(matchNum[3]), parseInt(matchNum[2]) - 1, parseInt(matchNum[1]));
    } else {
      // Intentar parseo directo (Date string de Google)
      const d = new Date(texto);
      if (!isNaN(d.getTime())) fechaNac = d;
    }
  }

  if (!fechaNac || isNaN(fechaNac.getTime())) return '';

  const hoy = new Date();
  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const mesDiff = hoy.getMonth() - fechaNac.getMonth();
  if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < fechaNac.getDate())) {
    edad--;
  }
  return String(edad);
}

/**
 * Convierte una fecha a formato YYYY-MM-DD (para inputs type="date").
 */
function formatearFechaInput(valorFecha: any): string {
  if (!valorFecha) return '';
  const texto = String(valorFecha).trim();
  if (!texto) return '';

  // Ya está en YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;

  // "16 de noviembre de 1996"
  const matchTexto = texto.match(/^(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})$/i);
  if (matchTexto) {
    const meses: Record<string, string> = {
      enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
      julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
    };
    const mes = meses[matchTexto[2].toLowerCase()];
    if (mes) {
      const dia = matchTexto[1].padStart(2, '0');
      return `${matchTexto[3]}-${mes}-${dia}`;
    }
  }

  // "DD/MM/YYYY"
  const matchNum = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (matchNum) {
    return `${matchNum[3]}-${matchNum[2].padStart(2, '0')}-${matchNum[1].padStart(2, '0')}`;
  }

  // Date string de Google "Sat Nov 16 1996 ..."
  const d = new Date(texto);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  return '';
}

function normalizarGenero(valor: any): string {
  const g = String(valor || '').trim().toUpperCase();
  if (g === 'M' || g === 'MASCULINO') return 'Masculino';
  if (g === 'F' || g === 'FEMENINO') return 'Femenino';
  return valor || '';
}

function normalizarEstadoCivil(valor: any): string {
  const v = String(valor || '').trim();
  const mapa: Record<string, string> = {
    soltero: 'Soltero', soltera: 'Soltera',
    casado: 'Casado', casada: 'Casada',
    divorciado: 'Divorciado', divorciada: 'Divorciada',
    viudo: 'Viudo', viuda: 'Viuda',
    acompañado: 'Acompañado', acompañada: 'Acompañada',
  };
  return mapa[v.toLowerCase()] || v;
}

/**
 * Formatea un empleado del caché al formato que espera el formulario de contratos.
 */
function formatearParaApp(emp: any) {
  if (!emp) return null;

  const municipio = String(emp.municipio || '').trim();
  const departamento = String(emp.departamento || '').trim();
  const municipioLab = String(emp.municipioLaboral || '').trim();
  const departamentoLab = String(emp.departamentoLaboral || '').trim();
  const fechaNacimiento = String(emp.fechaNacimiento || '').trim();

  // Normalizar salario: quitar $, comas, dejar número
  const salarioStr = String(emp.salario || '0').replace(/[^0-9.]/g, '');
  const salarioNum = parseFloat(salarioStr) || 0;

  return {
    encontrado: true,
    codigo: String(emp.codigo || ''),
    // Datos del empleado
    nombreEmpleado: String(emp.nombre || '').trim(),
    duiEmpleado: String(emp.dui || '').trim(),
    edadEmpleado: calcularEdad(fechaNacimiento),
    sexoEmpleado: normalizarGenero(emp.genero),
    nacionalidadEmpleado: String(emp.nacionalidad || '').trim(),
    estadoFamiliarEmpleado: normalizarEstadoCivil(emp.estadoCivil),
    profesionEmpleado: String(emp.gradoAcademico || '').trim(),
    domicilioEmpleado: String(emp.domicilio || '').trim(),
    residenciaEmpleado: [municipio, departamento].filter(Boolean).join(', '),
    lugarExpedicionDuiEmpleado: '',
    fechaExpedicionDuiEmpleado: '',
    // Datos del contrato
    cargoPuesto: String(emp.cargo || '').trim(),
    fechaInicioServicio: formatearFechaInput(emp.fechaIngreso),
    direccionPrestacionServicios: String(emp.direccionLaboral || '').trim(),
    lugarPrestacionServicios: [municipioLab, departamentoLab].filter(Boolean).join(', '),
    salarioEnNumeros: salarioNum ? `$${salarioNum.toFixed(2)}` : String(emp.salario || '').trim(),
    // Metadatos
    branch: departamentoLab || municipioLab || '',
    employeeName: String(emp.nombre || '').trim(),
    salary: salarioNum,
    // Todos los dependientes (sin límite de 2)
    dependientes: (emp.dependientes || []).map((d: any) => ({
      nombre: String(d.nombre || '').trim(),
      apellido: String(d.apellido || '').trim(),
      edad: '',
      parentesco: String(d.parentesco || '').trim(),
      direccion: '',
    })),
    // Fecha de nacimiento para calcular edad en el frontend si es necesario
    _extra: {
      fechaNacimiento,
    },
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const codigo = searchParams.get('codigo');
  const todos = searchParams.get('todos');

  const cache = await readCache();

  // Sin caché: pedir al usuario que presione "Actualizar"
  if (cache.empleados.length === 0) {
    return NextResponse.json({
      ok: false,
      error: 'No hay datos sincronizados. Presiona el botón "Actualizar" para descargarlos de Google Sheets.',
      cacheVacio: true,
    });
  }

  try {
    // Lista resumida (código + nombre) para el dropdown
    if (todos === '1') {
      const lista = cache.empleados.map((emp: any) => ({
        codigo: String(emp.codigo || ''),
        nombre: String(emp.nombre || ''),
      }));
      return NextResponse.json({ ok: true, total: lista.length, empleados: lista });
    }

    // Buscar uno por código (compara como número, ignora formato 0001 vs 1)
    if (codigo) {
      const codigoInt = parseInt(String(codigo).replace(/^0+/, '') || '0', 10);
      const empleado = cache.empleados.find((emp: any) => {
        const empInt = parseInt(String(emp.codigo).replace(/^0+/, '') || '0', 10);
        return empInt === codigoInt;
      });

      if (empleado) {
        return NextResponse.json({ ok: true, data: formatearParaApp(empleado) });
      }
      return NextResponse.json({
        ok: false,
        error: 'Empleado no encontrado',
        data: { encontrado: false },
      });
    }

    // Sin parámetros: lista resumida
    const lista = cache.empleados.map((emp: any) => ({
      codigo: String(emp.codigo || ''),
      nombre: String(emp.nombre || ''),
    }));
    return NextResponse.json({ ok: true, total: lista.length, empleados: lista });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: `Error leyendo caché: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
