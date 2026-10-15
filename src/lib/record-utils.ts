import type { OvertimeRecord } from './types';

/**
 * Normaliza una fecha (Date o string ISO) a su clave de día YYYY-MM-DD.
 * Evita falsos negativos por diferencias de hora/milisegundos/zona horaria
 * al comparar registros.
 */
export function normalizeDateKey(date: unknown): string {
  if (date instanceof Date && !isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }
  const raw = String(date ?? '').trim();
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : raw.slice(0, 10);
}

/** Registro al que se le puede haber inyectado el nombre del empleado dueño. */
type WithEmployeeName = Partial<OvertimeRecord> & { employeeName?: string };

/**
 * Normaliza un nombre de empleado para poder compararlo:
 * mayúsculas, sin espacios sobrantes y con un solo espacio entre palabras
 * (los archivos con doble guion bajo, ej. JOSUE__DANIEL_ROMERO_CHICAS.json,
 * generan "JOSUE  DANIEL ROMERO CHICAS" con doble espacio).
 */
export function normalizeEmployeeName(name?: string | null): string {
  return (name || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Compara dos registros por su contenido (fecha laboral, horario y actividad).
 * Red de seguridad para detectar duplicados aunque tengan IDs distintos.
 *
 * IMPORTANTE: si ambos registros traen el nombre del empleado, deben pertenecer
 * a la MISMA persona. Dos colaboradores que trabajaron juntos y describieron la
 * misma actividad (misma fecha, mismo horario, misma descripción) NO son un
 * duplicado: son dos jornadas distintas y ambas deben conservarse.
 */
export function isSameRecordContent(
  a: WithEmployeeName | null | undefined,
  b: WithEmployeeName | null | undefined
): boolean {
  if (!a || !b) return false;

  const empA = normalizeEmployeeName(a.employeeName);
  const empB = normalizeEmployeeName(b.employeeName);
  if (empA && empB && empA !== empB) return false;

  return (
    normalizeDateKey(a.date) === normalizeDateKey(b.date) &&
    (a.startTime || '').trim() === (b.startTime || '').trim() &&
    (a.endTime || '').trim() === (b.endTime || '').trim() &&
    (a.activity || '').trim().toLowerCase() === (b.activity || '').trim().toLowerCase()
  );
}

/**
 * Elimina registros duplicados de una lista, por id o por contenido idéntico.
 */
export function dedupeRecords<T extends { id?: string }>(records: T[]): T[] {
  const result: T[] = [];
  for (const r of records) {
    const isDup = result.some(
      (seen) => (r.id && seen.id && r.id === seen.id) || isSameRecordContent(seen as any, r as any)
    );
    if (!isDup) result.push(r);
  }
  return result;
}
