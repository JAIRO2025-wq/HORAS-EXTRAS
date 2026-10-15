'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FolderArchive,
  PlusCircle,
  Loader2,
  FileText,
  Download,
  Trash2,
  Calendar,
  Eye,
  ClipboardList,
} from 'lucide-react';
import { HistoryForm } from './history-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { HistoryEntry } from '@/lib/types';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMonthlySettings } from '@/hooks/use-monthly-settings';
import { months } from '@/lib/data';
import { isPendingPermit, permitStatusClasses, permitStatusLabel } from '@/lib/history-utils';
import { HistoryViewerDialog } from '@/components/history/history-viewer-dialog';

type KindFilter = 'all' | 'document' | 'permit';

export function HistoryTracker() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [viewing, setViewing] = useState<HistoryEntry | null>(null);
  const { toast } = useToast();

  const { month } = useMonthlySettings();

  /** Historial consolidado del colaborador: sus documentos + sus permisos. */
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/history?consolidated=1');
      if (res.ok) {
        const data = await res.json();
        setEntries(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // El historial del colaborador se muestra para el MES CONTABLE activo,
  // tanto los documentos (por fecha de carga) como los permisos (por fecha de solicitud).
  const visibleEntries = useMemo(() => {
    if (!month) return [];
    const monthIndex = months.indexOf(month);
    if (monthIndex === -1) return [];
    return entries.filter((e) => {
      const d = parseISO(e.date);
      if (!isValid(d) || d.getMonth() !== monthIndex) return false;
      if (kindFilter !== 'all' && e.kind !== kindFilter) return false;
      return true;
    });
  }, [entries, month, kindFilter]);

  const counts = useMemo(
    () => ({
      documents: visibleEntries.filter((e) => e.kind === 'document').length,
      permits: visibleEntries.filter((e) => e.kind === 'permit').length,
      pending: visibleEntries.filter((e) => e.kind === 'permit' && isPendingPermit(e.status)).length,
    }),
    [visibleEntries]
  );

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este documento de tu expediente?')) return;

    try {
      const res = await fetch('/api/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => !(e.kind === 'document' && e.id === id)));
        toast({ title: 'Documento Eliminado' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error al eliminar' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline flex items-center gap-2">
            <FolderArchive className="h-6 w-6 text-primary" />
            Mi Historial
          </h2>
          <p className="text-sm text-muted-foreground">
            Tus documentos del expediente y tus permisos de {month || 'este periodo'}, en una sola línea de tiempo.
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="gap-2 shadow-lg h-11 bg-primary text-white">
          <PlusCircle className="h-4 w-4" /> Subir Documento
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          { value: 'all', label: `Todo (${visibleEntries.length})`, icon: ClipboardList },
          { value: 'document', label: `Documentos (${counts.documents})`, icon: FolderArchive },
          { value: 'permit', label: `Permisos (${counts.permits})`, icon: FileText },
        ] as const).map((opt) => (
          <Button
            key={opt.value}
            variant={kindFilter === opt.value ? 'default' : 'outline'}
            size="sm"
            className="h-9 gap-2"
            onClick={() => setKindFilter(opt.value)}
          >
            <opt.icon className="h-3.5 w-3.5" /> {opt.label}
          </Button>
        ))}
        {counts.pending > 0 && (
          <Badge variant="outline" className="h-9 px-3 gap-1 text-[10px] bg-amber-50 text-amber-700 border-amber-200">
            {counts.pending} permiso(s) en trámite
          </Badge>
        )}
      </div>

      <div className="grid gap-4">
        {visibleEntries.length > 0 ? (
          visibleEntries.map((entry) => (
            <Card
              key={`${entry.kind}-${entry.id}`}
              className={`group hover:shadow-md transition-all border-l-4 bg-card ${
                entry.kind === 'permit'
                  ? isPendingPermit(entry.status)
                    ? 'border-l-amber-400'
                    : entry.status === 'rejected'
                    ? 'border-l-red-400'
                    : 'border-l-green-400'
                  : 'border-l-primary/40'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-xl shrink-0 ${
                        entry.kind === 'permit' ? 'bg-blue-50 text-blue-600' : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {entry.kind === 'permit' ? <FileText className="h-6 w-6" /> : <FolderArchive className="h-6 w-6" />}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base uppercase tracking-tight">{entry.title}</h3>
                        <Badge variant="outline" className="text-[9px] h-4 bg-zinc-50">
                          {entry.kind === 'permit' ? 'PERMISO' : entry.fileName?.split('.').pop()?.toUpperCase() || 'DOCUMENTO'}
                        </Badge>
                        {entry.kind === 'permit' && (
                          <Badge
                            variant="outline"
                            className={`text-[9px] h-4 ${permitStatusClasses(entry.status)}`}
                          >
                            {permitStatusLabel(entry.status)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                        <Calendar className="h-3 w-3" />
                        {entry.kind === 'permit' ? (
                          <>
                            {entry.detail} · solicitado el{' '}
                            {format(parseISO(entry.date), "dd 'de' MMMM, yyyy", { locale: es })}
                          </>
                        ) : (
                          <>Cargado: {format(parseISO(entry.date), "dd 'de' MMMM, yyyy", { locale: es })}</>
                        )}
                      </div>
                      {entry.kind === 'permit' && entry.justification && (
                        <p className="text-xs text-zinc-500 italic line-clamp-2">“{entry.justification}”</p>
                      )}
                      {entry.notes && <p className="text-xs text-zinc-500 italic">"{entry.notes}"</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => setViewing(entry)}>
                      <Eye className="h-4 w-4" /> Ver
                    </Button>
                    {entry.hasFile && entry.fileUrl && (
                      <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                        <a href={entry.fileUrl} download={entry.fileName || undefined} title="Descargar">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {entry.kind === 'document' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-3xl flex flex-col items-center">
            <FolderArchive className="h-12 w-12 opacity-10 mb-4" />
            <h3 className="font-bold text-lg text-muted-foreground/60">Sin movimientos en este periodo</h3>
            <p className="text-sm text-muted-foreground/40 max-w-xs mt-1">
              Aquí verás tus documentos y los permisos que solicites en {month || 'el periodo activo'}.
            </p>
          </div>
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Subir Documento</DialogTitle>
            <DialogDescription>Añade un nuevo archivo a tu expediente digital.</DialogDescription>
          </DialogHeader>
          <HistoryForm
            onSuccess={() => {
              setIsFormOpen(false);
              fetchHistory();
            }}
          />
        </DialogContent>
      </Dialog>

      <HistoryViewerDialog entry={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
