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

/**
 * Compara dos registros por su contenido (fecha laboral, horario y actividad).
 * Red de seguridad para detectar duplicados aunque tengan IDs distintos.
 */
export function isSameRecordContent(
  a: Partial<OvertimeRecord> | null | undefined,
  b: Partial<OvertimeRecord> | null | undefined
): boolean {
  if (!a || !b) return false;
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
