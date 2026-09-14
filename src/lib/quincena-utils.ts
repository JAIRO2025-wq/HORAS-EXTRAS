import { parseISO } from 'date-fns';
import { months } from '@/lib/data';

export type MonthlySettings = {
  quincena1_active: boolean;
  quincena2_active: boolean;
  quincena1_cutoff: number;
  quincena2_cutoff: number;
};

/**
 * Determina a qué quincena pertenece una fecha dentro de un mes contable,
 * considerando únicamente las quincenas ACTIVAS.
 *
 * Reglas:
 *  - La fecha debe pertenecer al mes contable indicado.
 *  - Si el día <= quincena1_cutoff → Q1 (solo si quincena1_active).
 *  - Si el día <= quincena2_cutoff → Q2 (solo si quincena2_active).
 *  - Fuera de rango o quincena inactiva → null.
 */
export function resolveActiveQuincena(
  dateInput: string | Date,
  month: string,
  settings: MonthlySettings
): 1 | 2 | null {
  const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
  if (!date || isNaN(date.getTime())) return null;

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
 * Devuelve las quincenas activas de un mes según su configuración.
 * Ej: { quincena1_active: true, quincena2_active: false } → [1]
 */
export function getActiveQuincenas(settings: MonthlySettings): number[] {
  const active: number[] = [];
  if (settings.quincena1_active) active.push(1);
  if (settings.quincena2_active) active.push(2);
  return active;
}

/**
 * Indica si una fecha cae dentro de alguna quincena activa del mes contable.
 */
export function isInActiveQuincena(
  dateInput: string | Date,
  month: string,
  settings: MonthlySettings
): boolean {
  return resolveActiveQuincena(dateInput, month, settings) !== null;
}
