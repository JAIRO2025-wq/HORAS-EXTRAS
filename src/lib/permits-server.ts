import fs from 'fs/promises';
import path from 'path';
import { parseISO } from 'date-fns';
import type { PermitRequest } from './types';

/**
 * Acceso a los permisos guardados en disco.
 * Único punto de lectura para /api/permits y para el Historial del Colaborador,
 * así ambas vistas siempre ven exactamente los mismos datos.
 */

const dataDir = path.join(process.cwd(), 'data');
const legacyPermitsFile = path.join(dataDir, 'permits.json');
const permitsBaseDir = path.join(dataDir, 'permits');
const evidencesDir = path.join(dataDir, 'evidences');

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Ruta del archivo mensual donde se guarda un permiso según su fecha de solicitud. */
export async function getPermitFilePath(dateIso: string): Promise<string> {
  const date = parseISO(dateIso);
  const year = date.getFullYear().toString();
  const month = MONTH_NAMES[date.getMonth()];
  const targetDir = path.join(permitsBaseDir, year);
  await fs.mkdir(targetDir, { recursive: true });
  return path.join(targetDir, `${month}.json`);
}

/**
 * Lee TODOS los permisos: el archivo legado (data/permits.json) más la
 * estructura jerárquica data/permits/[AÑO]/[Mes].json.
 */
export async function readAllPermits(): Promise<PermitRequest[]> {
  let all: PermitRequest[] = [];

  try {
    const legacyContent = await fs.readFile(legacyPermitsFile, 'utf-8');
    const legacy = JSON.parse(legacyContent);
    if (Array.isArray(legacy)) all = [...legacy];
  } catch (e) {}

  try {
    const years = await fs.readdir(permitsBaseDir).catch(() => [] as string[]);

    for (const year of years) {
      const yearDir = path.join(permitsBaseDir, year);
      const stats = await fs.stat(yearDir).catch(() => null);
      if (!stats || !stats.isDirectory()) continue;

      const monthFiles = await fs.readdir(yearDir).catch(() => [] as string[]);
      for (const file of monthFiles) {
        if (!file.toLowerCase().endsWith('.json')) continue;
        try {
          const content = await fs.readFile(path.join(yearDir, file), 'utf-8');
          const data = JSON.parse(content);
          if (Array.isArray(data)) all = [...all, ...data];
        } catch (e) {
          console.error(`Error leyendo permisos de ${file}:`, e);
        }
      }
    }
  } catch (e) {
    console.error('Error reading hierarchical permits:', e);
  }

  return all;
}

/**
 * Mapa id de permiso -> nombre del justificante guardado en data/evidences.
 * Permite saber si el archivo existe de verdad (y su extensión) antes de
 * ofrecer el botón de ver/descargar.
 */
export async function readEvidenceFiles(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const files = await fs.readdir(evidencesDir);
    for (const file of files) {
      const dot = file.lastIndexOf('.');
      const id = dot > 0 ? file.slice(0, dot) : file;
      map.set(id, file);
    }
  } catch (e) {}
  return map;
}
