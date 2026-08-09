
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  parse,
  differenceInMinutes,
  addDays,
  set,
  isAfter,
  isBefore,
  max,
  min,
  format,
  isValid,
} from 'date-fns';
import type { OvertimeRecord } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateOvertime(
  date: Date,
  startTime: string,
  endTime: string
) {
  if (!date || !startTime || !endTime) {
    return { totalHours: 0, dayHours: 0, nightHours: 0 };
  }

  // Asegurar que la fecha sea válida
  const baseDate = new Date(date);
  if (!isValid(baseDate)) return { totalHours: 0, dayHours: 0, nightHours: 0 };

  const startDate = parse(startTime, 'hh:mm a', baseDate);
  let endDate = parse(endTime, 'hh:mm a', baseDate);

  if (!isValid(startDate) || !isValid(endDate)) {
    return { totalHours: 0, dayHours: 0, nightHours: 0 };
  }

  if (isAfter(startDate, endDate)) {
    endDate = addDays(endDate, 1);
  }

  const totalMinutes = differenceInMinutes(endDate, startDate);
  if (totalMinutes <= 0 || isNaN(totalMinutes)) {
    return { totalHours: 0, dayHours: 0, nightHours: 0 };
  }

  let dayMinutes = 0;

  const dayStart1 = set(startDate, { hours: 6, minutes: 0, seconds: 0 });
  const dayEnd1 = set(startDate, { hours: 19, minutes: 0, seconds: 0 });
  const dayStart2 = addDays(dayStart1, 1);
  const dayEnd2 = addDays(dayEnd1, 1);

  // Intersección día 1
  const intersectionStart1 = max([startDate, dayStart1]);
  const intersectionEnd1 = min([endDate, dayEnd1]);
  if (isAfter(intersectionEnd1, intersectionStart1)) {
    dayMinutes += differenceInMinutes(intersectionEnd1, intersectionStart1);
  }

  // Intersección día 2 (turnos nocturnos que terminan después de las 6am del día siguiente)
  const intersectionStart2 = max([startDate, dayStart2]);
  const intersectionEnd2 = min([endDate, dayEnd2]);
  if (isAfter(intersectionEnd2, intersectionStart2)) {
    dayMinutes += differenceInMinutes(intersectionEnd2, intersectionStart2);
  }

  const totalHours = totalMinutes / 60;
  const dayHours = dayMinutes / 60;
  const nightHours = Math.max(0, totalHours - dayHours);

  return {
    totalHours: parseFloat(totalHours.toFixed(4)),
    dayHours: parseFloat(dayHours.toFixed(4)),
    nightHours: parseFloat(nightHours.toFixed(4)),
  };
}

export function getOvertimeHoursFromRecord(record: OvertimeRecord) {
  const { date, startTime, endTime, type } = record;

  if (type === 'additional_day') {
    return {
      totalHours: record.totalHours || 0,
      dayHours: 0,
      nightHours: 0,
    };
  }

  return calculateOvertime(new Date(date), startTime, endTime);
}

/**
 * Verifica si dos rangos de tiempo se solapan
 */
export function isTimeOverlapping(
  date1: Date, start1: string, end1: string,
  date2: Date, start2: string, end2: string
): boolean {
  if (format(date1, 'yyyy-MM-dd') !== format(new Date(date2), 'yyyy-MM-dd')) return false;

  const s1 = parse(start1, 'hh:mm a', date1);
  let e1 = parse(end1, 'hh:mm a', date1);
  if (!isValid(s1) || !isValid(e1)) return false;
  if (isAfter(s1, e1)) e1 = addDays(e1, 1);

  const s2 = parse(start2, 'hh:mm a', new Date(date2));
  let e2 = parse(end2, 'hh:mm a', new Date(date2));
  if (!isValid(s2) || !isValid(e2)) return false;
  if (isAfter(s2, e2)) e2 = addDays(e2, 1);

  return s1 < e2 && e1 > s2;
}

// ============================================================
// Conversión de número a letras en español (para contratos)
// ============================================================

const UNIDADES = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const DECENAS = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const ESPECIALES: Record<number, string> = {
  10: 'diez', 11: 'once', 12: 'doce', 13: 'trece', 14: 'catorce',
  15: 'quince', 16: 'dieciséis', 17: 'diecisiete', 18: 'dieciocho', 19: 'diecinueve',
  20: 'veinte', 21: 'veintiuno', 22: 'veintidós', 23: 'veintitrés', 24: 'veinticuatro',
  25: 'veinticinco', 26: 'veintiséis', 27: 'veintisiete', 28: 'veintiocho', 29: 'veintinueve',
};
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function convertirCentenas(n: number): string {
  if (n === 100) return 'cien';
  if (n > 100 && n < 1000) {
    const c = Math.floor(n / 100);
    const resto = n % 100;
    const cent = CENTENAS[c];
    const restoTxt = convertirDecenas(resto);
    return restoTxt ? `${cent} ${restoTxt}` : cent;
  }
  return convertirDecenas(n);
}

function convertirDecenas(n: number): string {
  if (n < 10) return UNIDADES[n];
  if (n < 30 && ESPECIALES[n]) return ESPECIALES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  const dec = DECENAS[d];
  const uni = UNIDADES[u];
  return uni ? `${dec} y ${uni}` : dec;
}

function convertirGrupo(n: number, singular: string, plural: string): string {
  if (n === 0) return '';
  if (n === 1) {
    if (singular === 'mil') return 'mil';
    return `un ${singular}`;
  }
  if (singular === 'mil') return `${convertirCentenas(n)} mil`;
  const parte = convertirCentenas(n);
  return `${parte} ${plural}`;
}

export function numeroALetras(cantidad: number): string {
  if (cantidad === 0) return 'cero dólares';

  const enteros = Math.floor(cantidad);
  const centavos = Math.round((cantidad - enteros) * 100);

  let resultado = '';
  if (enteros === 0) {
    resultado = 'cero';
  } else {
    const millones = Math.floor(enteros / 1_000_000);
    const miles = Math.floor((enteros % 1_000_000) / 1_000);
    const resto = enteros % 1_000;

    const partes: string[] = [];
    if (millones > 0) partes.push(convertirGrupo(millones, 'millón', 'millones'));
    if (miles > 0) partes.push(convertirGrupo(miles, 'mil', 'mil'));
    if (resto > 0) partes.push(convertirGrupo(resto, '', ''));

    resultado = partes.join(' ').trim();
  }

  resultado = resultado.charAt(0).toUpperCase() + resultado.slice(1);

  if (enteros === 1) resultado += ' dólar';
  else resultado += ' dólares';

  if (centavos > 0) {
    resultado += ` con ${convertirDecenas(centavos)} centavos`;
  }

  return resultado.trim();
}

// ============================================================
// Conversión de fecha a letras en español
// ============================================================

const MESES_LETRAS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function numeroAFechaLetras(n: number): string {
  if (n === 1) return 'primero';
  if (n <= 30 && ESPECIALES[n]) return ESPECIALES[n];
  if (n === 30) return 'treinta';
  if (n === 31) return 'treinta y uno';
  return convertirDecenas(n);
}

function anioALetras(anio: number): string {
  const miles = Math.floor(anio / 1000);
  const resto = anio % 1000;
  if (resto === 0) return `${convertirCentenas(miles)} mil`;
  return `${convertirCentenas(miles)} mil ${convertirCentenas(resto)}`;
}

export function fechaEnLetras(fecha: Date): string {
  const dia = fecha.getDate();
  const mes = fecha.getMonth();
  const anio = fecha.getFullYear();
  const diaLetras = numeroAFechaLetras(dia);
  const mesLetras = MESES_LETRAS[mes];
  const anioLetras = anioALetras(anio);
  return `a los ${diaLetras} días del mes de ${mesLetras} de ${anioLetras}`;
}
