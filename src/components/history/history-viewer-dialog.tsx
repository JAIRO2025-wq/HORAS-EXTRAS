'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, FileBadge, FileText, FolderArchive, X, AlertTriangle } from 'lucide-react';
import { PdfViewer } from '@/components/ui/pdf-viewer';
import type { HistoryEntry } from '@/lib/types';
import {
  HISTORY_KIND_LABEL,
  permitStatusClasses,
  permitStatusLabel,
} from '@/lib/history-utils';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function fmtHistoryDate(iso?: string, pattern = "dd/MM/yyyy"): string {
  if (!iso) return '—';
  const d = parseISO(iso);
  return isValid(d) ? format(d, pattern, { locale: es }) : String(iso).slice(0, 10);
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
      <p className="text-[11px] text-zinc-700 leading-snug break-words whitespace-pre-line">{value}</p>
    </div>
  );
}

/**
 * Visor del Historial del Colaborador.
 * Sirve tanto para un documento del expediente como para un permiso
 * (muestra la ficha del permiso y su justificante).
 */
export function HistoryViewerDialog({
  entry,
  onClose,
}: {
  entry: HistoryEntry | null;
  onClose: () => void;
}) {
  const isPermit = entry?.kind === 'permit';

  return (
    <Dialog open={!!entry} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b flex flex-row items-center justify-between bg-white shrink-0">
          <DialogTitle className="flex items-center gap-2 min-w-0">
            {isPermit ? (
              <FileText className="h-5 w-5 text-primary shrink-0" />
            ) : (
              <FolderArchive className="h-5 w-5 text-primary shrink-0" />
            )}
            <div className="flex flex-col text-left min-w-0">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                {entry ? HISTORY_KIND_LABEL[entry.kind] : ''} · {entry?.employeeName}
              </span>
              <span className="text-sm font-bold text-zinc-900 truncate">{entry?.title}</span>
            </div>
          </DialogTitle>
          <div className="flex items-center gap-2 shrink-0">
            {entry?.hasFile && entry.fileUrl && (
              <Button variant="outline" size="sm" className="h-8 gap-1" asChild>
                <a href={entry.fileUrl} download={entry.fileName || undefined}>
                  <Download className="h-3.5 w-3.5" /> Descargar
                </a>
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {isPermit && entry && (
          <div className="shrink-0 border-b bg-muted/20 p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Estado</p>
              <Badge variant="outline" className={`text-[10px] mt-0.5 ${permitStatusClasses(entry.status)}`}>
                {permitStatusLabel(entry.status)}
              </Badge>
            </div>
            <Field label="Periodo solicitado" value={entry.detail} />
            <Field label="Solicitado el" value={fmtHistoryDate(entry.date, 'dd/MM/yyyy HH:mm')} />
            <Field
              label="Sucursal / Puesto"
              value={[entry.branch, entry.position].filter(Boolean).join(' · ') || undefined}
            />
            <Field label="Justificación" value={entry.justification} />
            <Field label="Eventualidad" value={entry.eventuality} />
            <Field label="Aval de jefatura" value={entry.supervisorName} />
            <Field
              label="Resolución"
              value={
                entry.approvedBy
                  ? `${entry.approvedBy}${entry.approvedAt ? ` · ${fmtHistoryDate(entry.approvedAt, 'dd/MM/yyyy HH:mm')}` : ''}`
                  : undefined
              }
            />
            <Field label="Notas de administración" value={entry.notes} />
          </div>
        )}

        <div className="flex-1 relative bg-zinc-100 min-h-0">
          {entry && entry.hasFile && entry.fileUrl ? (
            entry.isImage ? (
              <div className="h-full w-full p-4 overflow-auto flex justify-center items-start">
                <img
                  src={entry.fileUrl}
                  alt={entry.fileName || entry.title}
                  className="max-w-full h-auto shadow-2xl rounded-lg border-4 border-white"
                />
              </div>
            ) : (
              <PdfViewer file={entry.fileUrl} />
            )
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-center p-8">
              <AlertTriangle className="h-10 w-10 text-amber-400" />
              <p className="font-bold text-zinc-600">Esta entrada no tiene archivo adjunto</p>
              <p className="text-xs text-zinc-400 max-w-sm">
                {isPermit
                  ? 'El permiso se registró sin justificante. Los datos de la solicitud quedan guardados en el historial.'
                  : entry?.notes
                  ? `Notas: ${entry.notes}`
                  : 'No hay nada que previsualizar.'}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
