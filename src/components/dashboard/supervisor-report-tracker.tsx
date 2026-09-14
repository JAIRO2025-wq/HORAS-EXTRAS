'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PlusCircle, Loader2, UserX, Calendar, FileSearch, Image as ImageIcon,
  X, MessageSquare, CheckCircle2, Clock, Eye,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { PdfViewer } from '@/components/ui/pdf-viewer';
import { SupervisorReportForm } from './supervisor-report-form';
import type { SupervisorReport } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMonthlySettings } from '@/hooks/use-monthly-settings';
import { resolveActiveQuincena } from '@/lib/quincena-utils';

export function SupervisorReportTracker() {
  const [reports, setReports] = useState<SupervisorReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; month: string } | null>(null);
  const [viewingEvidence, setViewingEvidence] = useState<string | null>(null);

  const { settings, month } = useMonthlySettings();

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch('/api/supervisor-reports');
      if (res.ok) {
        setReports(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('overtimeUser');
    if (stored) {
      setUser(JSON.parse(stored));
      fetchReports();
    }
  }, [fetchReports]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'reviewed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 gap-1"><CheckCircle2 className="h-3 w-3" /> Revisado</Badge>;
      case 'dismissed':
        return <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" /> Descartado</Badge>;
      default:
        return <Badge variant="outline" className="opacity-70 gap-1"><Clock className="h-3 w-3" /> Pendiente</Badge>;
    }
  };

  // Solo se muestran los reportes de la QUINCENA ACTIVA que fueron REVISADOS
  // (aprobados) por la administración.
  const visibleReports = useMemo(() => {
    if (!settings || !month) return [];
    return reports.filter(r => {
      if (r.status !== 'reviewed') return false;
      return resolveActiveQuincena(r.absenceDate, month, settings) !== null;
    });
  }, [reports, settings, month]);

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-headline flex items-center gap-2">
            <UserX className="h-6 w-6 text-primary" /> Reporte de Colaborador
          </h2>
          <p className="text-sm text-muted-foreground">
            Informa a administración sobre inasistencias de tu agencia.
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="gap-2 shadow-lg w-full sm:w-auto h-11">
          <PlusCircle className="h-4 w-4" /> Nuevo Reporte
        </Button>
      </div>

      <div className="grid gap-4">
        {visibleReports.length > 0 ? visibleReports.map(r => (
          <Card key={r.id} className="overflow-hidden border-l-4 border-l-primary group hover:shadow-md transition-all">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-bold text-primary">{r.employeeName}</span>
                    {getStatusBadge(r.status)}
                    <Badge variant="outline" className="text-[9px]">Q{r.quincena}</Badge>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-xs text-muted-foreground font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Falta: {format(parseISO(r.absenceDate), "eeee dd 'de' MMMM", { locale: es })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Reportado: {format(parseISO(r.reportDate), 'dd/MM/yy HH:mm')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-zinc-100 text-zinc-700 border-zinc-200 text-[10px]">{r.reason}</Badge>
                  </div>
                  <p className="text-sm italic text-zinc-600">"{r.justification}"</p>

                  {r.adminNotes && (
                    <div className="mt-2 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="h-3 w-3 text-blue-600" />
                        <span className="text-[10px] font-black uppercase text-blue-700 tracking-widest">Respuesta de RRHH</span>
                      </div>
                      <p className="text-sm text-blue-900 font-medium">{r.adminNotes}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-start sm:items-end justify-center gap-2">
                  {r.evidenceFileDataUri && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 gap-2 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      onClick={() => setViewingEvidence(r.evidenceFileDataUri!)}
                    >
                      {r.evidenceFileDataUri.includes('type=image') ? <ImageIcon className="h-3.5 w-3.5" /> : <FileSearch className="h-3.5 w-3.5" />}
                      Evidencia
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )) : (
          <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-xl flex flex-col items-center">
            <UserX className="h-12 w-12 opacity-10 mb-4" />
            <p className="text-muted-foreground font-medium">No has emitido reportes.</p>
            <p className="text-xs text-muted-foreground">Usa "Nuevo Reporte" para informar una inasistencia.</p>
          </div>
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl p-0 max-h-[95vh] overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>Nuevo Reporte de Colaborador</DialogTitle>
            <DialogDescription>Informa una inasistencia a administración.</DialogDescription>
          </DialogHeader>
          <SupervisorReportForm
            onSuccess={() => {
              setIsFormOpen(false);
              fetchReports();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingEvidence} onOpenChange={(open) => !open && setViewingEvidence(null)}>
        <DialogContent className="max-w-4xl h-[95vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between bg-white shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-primary" /> Evidencia del Reporte
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setViewingEvidence(null)} className="rounded-full">
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <div className="flex-1 relative bg-zinc-50 overflow-auto">
            {viewingEvidence && (
              (viewingEvidence.startsWith('data:image/') || viewingEvidence.includes('type=image')) ? (
                <div className="p-4 flex justify-center items-start min-h-full">
                  <img src={viewingEvidence} alt="Evidencia" className="max-w-full h-auto shadow-2xl rounded-lg" />
                </div>
              ) : (
                <PdfViewer file={viewingEvidence} />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
