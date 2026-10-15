import type {
  EmployeeHistoryRecord,
  HistoryEntry,
  PermitRequest,
  PermitStatus,
} from './types';
import { normalizeEmployeeName } from './record-utils';

/**
 * Utilidades del Historial del Colaborador.
 *
 * El historial se compone de dos fuentes que se conservan tal cual y solo se
 * consolidan para mostrarlas juntas:
 *   1. Documentos del expediente  -> data/employee_history.json
 *   2. Permisos solicitados       -> data/permits/...
 *
 * Este módulo es seguro para el cliente (no toca el sistema de archivos).
 */

export const PERMIT_STATUS_LABEL: Record<PermitStatus, string> = {
  pending: 'Esperando Jefe',
  pending_admin: 'Firma Admin Requerida',
  approved: 'Aprobado Final',
  rejected: 'Rechazado',
};

/** Orden en el que se listan los estados en los filtros. */
export const PERMIT_STATUSES: PermitStatus[] = ['pending', 'pending_admin', 'approved', 'rejected'];

export const HISTORY_KIND_LABEL: Record<HistoryEntry['kind'], string> = {
  document: 'Documento',
  permit: 'Permiso',
};

export function isPendingPermit(status?: string | null): boolean {
  return status === 'pending' || status === 'pending_admin';
}

export function permitStatusLabel(status?: string | null): string {
  if (!status) return '—';
  return PERMIT_STATUS_LABEL[status as PermitStatus] || String(status);
}

/** Clases del badge de estado (mismas que usa la sección de Permisos). */
export function permitStatusClasses(status?: string | null): string {
  switch (status) {
    case 'approved':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'rejected':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'pending_admin':
      return 'bg-blue-50 text-blue-800 border-blue-200 animate-pulse';
    case 'pending':
      return 'bg-zinc-100 text-zinc-600 border-zinc-200';
    default:
      return 'bg-zinc-50 text-zinc-500 border-zinc-200';
  }
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp)$/i;

export function isImageFile(fileName?: string | null): boolean {
  return !!fileName && IMAGE_EXT.test(fileName);
}

export function permitEvidenceUrl(permitId: string): string {
  return `/api/permits/evidence?id=${encodeURIComponent(permitId)}`;
}

/** Días solicitados en un permiso (inclusive). Mínimo 1. */
export function permitDays(permit: PermitRequest): number {
  const start = String(permit.startDate || '').slice(0, 10);
  const end = String(permit.endDate || start).slice(0, 10);
  if (!start) return 1;
  const [y1, m1, d1] = start.split('-').map(Number);
  const [y2, m2, d2] = end.split('-').map(Number);
  if (!y1 || !y2) return 1;
  const ms = Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1);
  const days = Math.round(ms / 86400000) + 1;
  return days > 0 ? days : 1;
}

/** "12/05/2026 → 13/05/2026 · 2 días" */
export function permitRangeText(permit: PermitRequest): string {
  const start = String(permit.startDate || '').slice(0, 10);
  const end = String(permit.endDate || start).slice(0, 10);
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return y && m && d ? `${d}/${m}/${y}` : iso;
  };
  const days = permitDays(permit);
  const daysTxt = days === 1 ? '1 día' : `${days} días`;
  return start === end ? `${fmt(start)} · ${daysTxt}` : `${fmt(start)} → ${fmt(end)} · ${daysTxt}`;
}

/**
 * Convierte un documento del expediente en una entrada del historial.
 */
export function documentToEntry(doc: EmployeeHistoryRecord): HistoryEntry {
  return {
    id: doc.id,
    kind: 'document',
    employeeName: doc.employeeName,
    date: doc.uploadDate,
    title: doc.documentType,
    detail: doc.fileName,
    notes: doc.notes,
    fileUrl: doc.fileUrl,
    fileName: doc.fileName,
    hasFile: !!doc.fileUrl,
    isImage: isImageFile(doc.fileName),
  };
}

/**
 * Convierte un permiso en una entrada del historial.
 * @param evidenceFiles mapa id de permiso -> nombre del justificante en disco.
 */
export function permitToEntry(
  permit: PermitRequest,
  evidenceFiles?: Map<string, string> | null
): HistoryEntry {
  const evidenceFileName = evidenceFiles?.get(permit.id);
  const hasFile = !!evidenceFileName || !!permit.evidenceFileDataUri;

  return {
    id: permit.id,
    kind: 'permit',
    employeeName: permit.employeeName || '',
    date: permit.requestDate || permit.startDate || '',
    title: permit.action || 'Permiso',
    detail: permitRangeText(permit),
    status: (permit.status as PermitStatus) || 'pending',
    notes: permit.adminNotes || '',
    branch: permit.branch || '',
    position: permit.position || '',
    startDate: permit.startDate,
    endDate: permit.endDate,
    days: permitDays(permit),
    justification: permit.justification || '',
    eventuality: permit.eventuality || '',
    supervisorName: permit.supervisorName || '',
    approvedBy: permit.approvedByAdminName || '',
    approvedAt: permit.approvedByAdminAt || permit.approvedBySupervisorAt || '',
    resolvedAt: permit.resolvedAt || '',
    fileUrl: hasFile ? permitEvidenceUrl(permit.id) : undefined,
    fileName: evidenceFileName || 'justificante',
    hasFile,
    isImage: isImageFile(evidenceFileName),
  };
}

/** Orden: más reciente primero; a igualdad de fecha, permisos antes que documentos. */
export function sortHistoryEntries(a: HistoryEntry, b: HistoryEntry): number {
  const ta = new Date(a.date).getTime() || 0;
  const tb = new Date(b.date).getTime() || 0;
  if (tb !== ta) return tb - ta;
  if (a.kind !== b.kind) return a.kind === 'permit' ? -1 : 1;
  return a.title.localeCompare(b.title);
}

/**
 * Construye la línea de tiempo consolidada del historial.
 * Conserva TODOS los documentos y TODOS los permisos; no descarta nada.
 */
export function buildHistoryEntries(
  documents: EmployeeHistoryRecord[],
  permits: PermitRequest[],
  evidenceFiles?: Map<string, string> | null
): HistoryEntry[] {
  const entries = [
    ...documents.map(documentToEntry),
    ...permits.map((p) => permitToEntry(p, evidenceFiles)),
  ];
  return entries.sort(sortHistoryEntries);
}

export type HistoryEmployeeGroup = {
  employeeName: string;
  branch?: string;
  entries: HistoryEntry[];
  documents: number;
  permits: number;
  pending: number;
  approved: number;
  rejected: number;
  /** Fecha de la entrada más reciente (ISO). */
  lastDate?: string;
};

/**
 * Agrupa las entradas por colaborador, que es como se consulta el historial.
 * Los nombres se normalizan (mayúsculas y espacios) para que un mismo
 * colaborador no se parta en dos grupos por diferencias de escritura.
 */
export function groupHistoryByEmployee(entries: HistoryEntry[]): HistoryEmployeeGroup[] {
  const groups = new Map<string, HistoryEmployeeGroup>();
  const displayName = new Map<string, string>();

  for (const entry of entries) {
    const key = normalizeEmployeeName(entry.employeeName) || 'SIN NOMBRE';
    let group = groups.get(key);
    if (!group) {
      group = {
        employeeName: entry.employeeName,
        branch: entry.branch || undefined,
        entries: [],
        documents: 0,
        permits: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        lastDate: undefined,
      };
      groups.set(key, group);
      displayName.set(key, entry.employeeName);
    }

    // Nos quedamos con la escritura más completa del nombre y con la sucursal si aparece.
    const current = displayName.get(key) || '';
    if (entry.employeeName && entry.employeeName.length > current.length) {
      displayName.set(key, entry.employeeName);
      group.employeeName = entry.employeeName;
    }
    if (!group.branch && entry.branch) group.branch = entry.branch;

    group.entries.push(entry);
    if (entry.kind === 'document') group.documents += 1;
    else {
      group.permits += 1;
      if (isPendingPermit(entry.status)) group.pending += 1;
      else if (entry.status === 'approved') group.approved += 1;
      else if (entry.status === 'rejected') group.rejected += 1;
    }
    if (!group.lastDate || new Date(entry.date) > new Date(group.lastDate)) {
      group.lastDate = entry.date;
    }
  }

  for (const group of groups.values()) {
    group.entries.sort(sortHistoryEntries);
    group.employeeName = displayName.get(normalizeEmployeeName(group.employeeName)) || group.employeeName;
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName, 'es')
  );
}
