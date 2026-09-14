'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { SupervisorReport } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { PdfViewer } from '@/components/ui/pdf-viewer';
import exportSupervisorReportsToExcel from '@/lib/export-supervisor-reports';
import {
  UserX, Building, Loader2, Clock, CheckCircle2, XCircle, X,
  FileSearch, Image as ImageIcon, MessageSquare, Eye, CalendarDays,
  ChevronLeft, ChevronRight, FileSpreadsheet,
} from 'lucide-react';

const ITEMS_PER_PAGE = 8;

export default function AdminSupervisorReportsPage() {
  const [reports, setReports] = useState<SupervisorReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [adminData, setAdminData] = useState<any>(null);
  const { toast } = useToast();

  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [quincenaFilter, setQuincenaFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [resolutionTarget, setResolutionTarget] = useState<SupervisorReport | null>(null);
  const [resolutionType, setResolutionType] = useState<'reviewed' | 'dismissed'>('reviewed');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [viewingEvidence, setViewingEvidence] = useState<string | null>(null);

  const fetchReports = useCallback(async (selectedMonth?: string) => {
    setIsLoading(true);
    try {
      const query = selectedMonth ? `?month=${encodeURIComponent(selectedMonth)}` : '';
      const res = await fetch(`/api/supervisor-reports${query}`);
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
    const stored = localStorage.getItem('overtimeAdmin');
    if (stored) {
      const parsed = JSON.parse(stored);
      setAdminData(parsed);
      fetchReports(parsed.month);
    }
  }, [fetchReports]);

  const branches = useMemo(() => {
    return Array.from(new Set(reports.map(r => r.branch).filter(Boolean))).sort();
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      if (branchFilter !== 'all' && r.branch !== branchFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (quincenaFilter !== 'all' && r.quincena !== Number(quincenaFilter)) return false;
      return true;
    });
  }, [reports, branchFilter, statusFilter, quincenaFilter]);

  const totalPages = Math.ceil(filteredReports.length / ITEMS_PER_PAGE);
  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredReports.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredReports, currentPage]);

  const handleExport = async () => {
    if (filteredReports.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Sin datos',
        description: 'No hay reportes para exportar con los filtros actuales.',
      });
      return;
    }
    try {
      const monthLabel = adminData?.month || 'Periodo';
      const quincenaLabel = quincenaFilter === 'all' ? '' : `_Q${quincenaFilter}`;
      await exportSupervisorReportsToExcel(
        filteredReports,
        `Reportes_Jefes_${monthLabel}${quincenaLabel}_${format(new Date(), 'yyyyMMdd_HHmm')}`
      );
      toast({ title: 'Excel generado', description: 'Consolidado + una hoja por sucursal.' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo generar el Excel.' });
    }
  };

  const handleOpenResolution = (report: SupervisorReport, type: 'reviewed' | 'dismissed') => {
    setResolutionTarget(report);
    setResolutionType(type);
    setResolutionNotes('');
  };

  const submitResolution = async () => {
    if (!resolutionTarget) return;
    setIsProcessing(resolutionTarget.id);
    try {
      const res = await fetch('/api/supervisor-reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: resolutionTarget.id,
          status: resolutionType,
          adminNotes: resolutionNotes,
        }),
      });
      if (res.ok) {
        toast({
          title: resolutionType === 'reviewed' ? 'Reporte marcado como Revisado' : 'Reporte Descartado',
        });
        setResolutionTarget(null);
        fetchReports(adminData?.month);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'reviewed':
        return <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-100 gap-1"><CheckCircle2 className="h-3 w-3" /> Revisado</Badge>;
      case 'dismissed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Descartado</Badge>;
      default:
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1"><Clock className="h-3 w-3" /> Pendiente</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* FILTROS */}
      <Card className="border-dashed border-2 bg-muted/5">
        <CardContent className="p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Building className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={branchFilter} onValueChange={(v) => { setBranchFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Agencia" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las agencias</SelectItem>
                {branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="reviewed">Revisados</SelectItem>
                <SelectItem value="dismissed">Descartados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={quincenaFilter} onValueChange={(v) => { setQuincenaFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Quincena" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las quincenas</SelectItem>
                <SelectItem value="1">Primera Quincena (Q1)</SelectItem>
                <SelectItem value="2">Segunda Quincena (Q2)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isLoading || filteredReports.length === 0}
            className="h-9 gap-2 border-green-600/30 text-green-700 hover:bg-green-50 font-bold shrink-0"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar Excel</span>
            <span className="sm:hidden">Excel</span>
          </Button>
        </CardContent>
      </Card>

      {/* TABLA */}
      <Card>
        <CardHeader className="pb-2 border-b bg-muted/5">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Reportes Recibidos</CardTitle>
            {totalPages > 1 && (
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  Página {currentPage} de {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Leyendo reportes...</p>
            </div>
          ) : filteredReports.length > 0 ? (
            <div className="overflow-x-auto">
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador / Agencia</TableHead>
                      <TableHead>Reportado por</TableHead>
                      <TableHead>Fecha de Falta</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>F. Reporte</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Gestión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedReports.map((r) => (
                      <TableRow key={r.id} className={r.status === 'pending' ? "bg-amber-50/40 border-l-4 border-l-amber-500 hover:bg-amber-100/40 transition-colors" : ""}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{r.employeeName}</span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase font-bold tracking-tight">
                              <Building className="h-2.5 w-2.5" /> {r.branch}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-[12px] font-bold text-primary">{r.supervisorName}</span>
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">Jefe de Agencia</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-[11px] font-mono whitespace-nowrap bg-zinc-50 px-2 py-1 rounded border">
                            <CalendarDays className="h-3 w-3 text-muted-foreground" />
                            {format(parseISO(r.absenceDate), 'dd/MM/yyyy')}
                            <Badge variant="outline" className="text-[8px] h-4 ml-1">Q{r.quincena}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <div className="flex flex-col gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className="bg-zinc-100 text-zinc-700 border-zinc-200 text-[9px] w-fit cursor-help">{r.reason}</Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[300px] p-4 text-xs bg-zinc-900 text-zinc-50 border-none shadow-2xl z-50 rounded-xl">
                                <p className="font-black mb-2 uppercase text-[9px] text-primary tracking-widest border-b border-white/10 pb-1">Motivo Reportado:</p>
                                <p className="leading-relaxed">{r.reason}</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-start gap-2 cursor-help group">
                                  <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                                  <span className="text-[11px] text-zinc-600 line-clamp-2 leading-tight italic">
                                    {r.justification}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[300px] p-4 text-xs bg-zinc-900 text-zinc-50 border-none shadow-2xl z-50 rounded-xl">
                                <p className="font-black mb-2 uppercase text-[9px] text-primary tracking-widest border-b border-white/10 pb-1">Detalle del Motivo:</p>
                                <p className="leading-relaxed italic">"{r.justification}"</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500">
                            {format(parseISO(r.reportDate), 'dd/MM HH:mm')}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(r.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {r.evidenceFileDataUri ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                onClick={() => setViewingEvidence(r.evidenceFileDataUri!)}
                                title="Ver Evidencia"
                              >
                                {r.evidenceFileDataUri.includes('type=image') ? <ImageIcon className="h-4 w-4" /> : <FileSearch className="h-4 w-4" />}
                              </Button>
                            ) : null}

                            {r.status === 'pending' ? (
                              <div className="flex gap-1">
                                <Button size="sm" className="bg-primary hover:bg-primary/90 h-8 text-[11px] px-3 font-bold" onClick={() => handleOpenResolution(r, 'reviewed')}>
                                  Revisar
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleOpenResolution(r, 'dismissed')}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button variant="outline" size="sm" className="h-8 gap-1 text-[11px] font-bold" onClick={() => setViewingEvidence(r.evidenceFileDataUri || null)} disabled={!r.evidenceFileDataUri}>
                                <Eye className="h-3 w-3" /> Ver
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </div>
          ) : (
            <div className="text-center py-24 text-muted-foreground italic flex flex-col items-center gap-2">
              <UserX className="h-10 w-10 opacity-10" />
              <p>No hay reportes de jefes en este periodo.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOGO DE RESOLUCION */}
      <Dialog open={!!resolutionTarget} onOpenChange={(open) => !open && setResolutionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {resolutionType === 'reviewed' ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
              {resolutionType === 'reviewed' ? 'Marcar como Revisado' : 'Descartar Reporte'}
            </DialogTitle>
            <DialogDescription>
              Colaborador: <strong>{resolutionTarget?.employeeName}</strong> | Reportado por: <strong>{resolutionTarget?.supervisorName}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/30 p-4 rounded-xl border border-dashed text-xs space-y-2">
              <p className="font-bold text-zinc-600 uppercase tracking-widest border-b pb-1">Resumen del Reporte:</p>
              <p>• Agencia: <strong>{resolutionTarget?.branch}</strong></p>
              <p>• Fecha de falta: <strong>{resolutionTarget?.absenceDate}</strong> (Q{resolutionTarget?.quincena})</p>
              <p>• Motivo: <strong>{resolutionTarget?.reason}</strong></p>
              <p>• Detalle: <span className="italic">"{resolutionTarget?.justification}"</span></p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="font-bold text-sm">Observaciones Administrativas</Label>
              <Textarea
                id="notes"
                placeholder="Describe la resolución u observaciones (opcional)..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="min-h-[120px] resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResolutionTarget(null)}>Cancelar</Button>
            <Button
              variant={resolutionType === 'reviewed' ? 'default' : 'destructive'}
              onClick={submitResolution}
              disabled={!!isProcessing}
              className="font-bold"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VISOR DE EVIDENCIA */}
      <Dialog open={!!viewingEvidence} onOpenChange={(open) => !open && setViewingEvidence(null)}>
        <DialogContent className="max-w-4xl h-[95vh] flex flex-col p-0 overflow-hidden bg-zinc-100">
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between bg-white shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-primary" /> Evidencia del Reporte
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setViewingEvidence(null)} className="rounded-full">
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <div className="flex-1 relative overflow-auto p-4 sm:p-8">
            {viewingEvidence ? (
              viewingEvidence.includes('type=image') ? (
                <div className="flex justify-center items-start min-h-full">
                  <img src={viewingEvidence} alt="Evidencia" className="max-w-full h-auto shadow-2xl rounded-xl border-4 border-white" />
                </div>
              ) : (
                <PdfViewer file={viewingEvidence} />
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-xs font-bold uppercase tracking-widest">Cargando documento...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
