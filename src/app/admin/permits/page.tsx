'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Scale, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Clock, 
  UserCheck, 
  Building,
  ArrowRight,
  FileSearch,
  MessageSquare,
  Download,
  X,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  History,
  FileDown,
  CalendarDays
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { PermitRequest } from '@/lib/types';
import { format, parseISO, startOfMonth, endOfMonth, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PermitPdfTemplate } from '@/components/admin/permit-pdf-template';
import { PdfViewer } from '@/components/ui/pdf-viewer';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import exportToExcel from '@/lib/export-to-excel';

const ITEMS_PER_PAGE = 8;

export default function AdminPermitsPage() {
  const [permits, setPermits] = useState<PermitRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [adminData, setAdminData] = useState<any>(null);
  const { toast } = useToast();

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);

  // Fechas para exportar
  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(endOfMonth(new Date()));

  // Estados para resolución
  const [resolutionTarget, setResolutionTarget] = useState<PermitRequest | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionType, setResolutionType] = useState<'approved' | 'rejected'>('approved');

  // Estado para PDF y Evidencia
  const [printingPermit, setPrintingPermit] = useState<PermitRequest | null>(null);
  const [viewingEvidence, setViewingEvidence] = useState<string | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const fetchPermits = useCallback(async (selectedMonth?: string) => {
    setIsLoading(true);
    try {
      const query = selectedMonth ? `?month=${encodeURIComponent(selectedMonth)}` : '';
      const res = await fetch(`/api/permits${query}`);
      if (res.ok) {
        const data = await res.json();
        setPermits(data);
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
      fetchPermits(parsed.month);
    }
  }, [fetchPermits]);

  const handleExport = async () => {
    if (!dateFrom || !dateTo) {
        toast({ variant: 'destructive', title: 'Fechas inválidas', description: 'Por favor selecciona ambas fechas para el reporte.' });
        return;
    }
    if (isAfter(dateFrom, dateTo)) {
        toast({ variant: 'destructive', title: 'Rango inválido', description: 'La fecha "Desde" no puede ser posterior a la fecha "Hasta".' });
        return;
    }

    setIsLoading(true);
    try {
        const query = `?from=${dateFrom.toISOString()}&to=${dateTo.toISOString()}`;
        const res = await fetch(`/api/permits${query}`);
        if (res.ok) {
            const data: PermitRequest[] = await res.json();
            if(data.length === 0){
              toast({ title: "Sin registros", description: "No se encontraron permisos en este rango." });
              return;
            }
            // Ahora esperamos a que se genere el Excel estilizado
            await exportToExcel(data, `Reporte_Permisos_${format(dateFrom, 'yyyy-MM-dd')}_a_${format(dateTo, 'yyyy-MM-dd')}`);
            toast({ title: "Excel generado", description: "El reporte estilizado se ha descargado con éxito." });
        } else {
          toast({ variant: 'destructive', title: 'Error servidor', description: 'No se pudo obtener la información de exportación.' });
        }
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error inesperado', description: 'Falló el proceso de exportación.' });
    } finally {
        setIsLoading(false);
    }
  };

  const sortedPermits = useMemo(() => {
    return [...permits].sort((a, b) => {
      const priority = { 'pending_admin': 0, 'pending': 1, 'approved': 2, 'rejected': 3 };
      const statusA = a.status as keyof typeof priority;
      const statusB = b.status as keyof typeof priority;
      
      if (priority[statusA] !== priority[statusB]) {
        return priority[statusA] - priority[statusB];
      }
      
      return new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime();
    });
  }, [permits]);

  const totalPages = Math.ceil(sortedPermits.length / ITEMS_PER_PAGE);
  const paginatedPermits = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedPermits.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedPermits, currentPage]);

  const handleOpenResolution = (permit: PermitRequest, type: 'approved' | 'rejected') => {
    setResolutionTarget(permit);
    setResolutionType(type);
    setResolutionNotes('');
  };

  const submitResolution = async () => {
    if (!resolutionTarget || !adminData) return;
    
    setIsProcessing(resolutionTarget.id);
    try {
      const res = await fetch('/api/permits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: resolutionTarget.id, 
          status: resolutionType,
          adminNotes: resolutionNotes,
          adminName: adminData.name
        })
      });
      if (res.ok) {
        toast({ title: resolutionType === 'approved' ? 'Permiso Autorizado Final' : 'Permiso Rechazado' });
        setResolutionTarget(null);
        fetchPermits(adminData.month);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDownloadPdf = async (permit: PermitRequest) => {
    setPrintingPermit(permit);
    setTimeout(async () => {
      if (!pdfRef.current) return;
      try {
        const canvas = await html2canvas(pdfRef.current, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min(pdfWidth / imgWidth, 1);
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth * ratio, imgHeight * ratio);
        pdf.save(`Accion_Personal_${permit.employeeName.replace(/ /g, '_')}.pdf`);
        toast({ title: "PDF Generado" });
      } catch (error) {
        console.error("PDF Error:", error);
      } finally {
        setPrintingPermit(null);
      }
    }, 500);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-100 gap-1"><CheckCircle2 className="h-3 w-3" /> Aprobado Final</Badge>;
      case 'rejected': return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rechazado</Badge>;
      case 'pending_admin': return <Badge className="bg-blue-100 text-blue-800 border-blue-200 gap-1 font-bold animate-pulse"><UserCheck className="h-3 w-3" /> Firma Admin Requerida</Badge>;
      case 'pending': return <Badge variant="outline" className="bg-zinc-100 text-zinc-600 gap-1"><Clock className="h-3 w-3" /> Esperando Jefe</Badge>;
      default: return <Badge variant="outline" className="opacity-60 gap-1"><Clock className="h-3 w-3" /> Desconocido</Badge>;
    }
  };

  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
                    <Scale className="h-6 w-6 text-primary" />
                    Buzón de Acciones de Personal
                </h1>
                <p className="text-muted-foreground text-sm">Gestionando registros de {adminData?.month}. Las solicitudes pendientes son siempre prioridad.</p>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
                <Button variant="outline" onClick={() => { fetchPermits(adminData?.month); setCurrentPage(1); }} disabled={isLoading} className="w-full sm:w-auto">
                    <Clock className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Sincronizar
                </Button>
            </div>
        </div>

        <Card className="border-dashed border-2 bg-muted/5">
            <CardHeader className="p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <CardTitle className="text-xs font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2">
                        <FileDown className="h-4 w-4" /> Generación de Reportes Excel
                    </CardTitle>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                        <div className="flex items-center gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full sm:w-[140px] justify-start text-left font-normal h-9 text-xs", !dateFrom && "text-muted-foreground")}>
                                        <CalendarDays className="mr-2 h-3.5 w-3.5 text-primary" />
                                        {dateFrom ? format(dateFrom, "dd/MM/yyyy") : <span>Desde</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus locale={es} />
                                </PopoverContent>
                            </Popover>
                            <span className="text-[10px] font-bold text-muted-foreground">al</span>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full sm:w-[140px] justify-start text-left font-normal h-9 text-xs", !dateTo && "text-muted-foreground")}>
                                        <CalendarDays className="mr-2 h-3.5 w-3.5 text-primary" />
                                        {dateTo ? format(dateTo, "dd/MM/yyyy") : <span>Hasta</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus locale={es} />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <Button onClick={handleExport} disabled={isLoading} size="sm" className="bg-green-600 hover:bg-green-700 text-white h-9 shadow-md">
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Exportar Datos
                        </Button>
                    </div>
                </div>
            </CardHeader>
        </Card>

      <Card>
        <CardHeader className="pb-2 border-b bg-muted/5">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Solicitudes y Trámites</CardTitle>
            {totalPages > 1 && (
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Página {currentPage} de {totalPages}</span>
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
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Leyendo archivos...</p>
            </div>
          ) : permits.length > 0 ? (
            <div className="overflow-x-auto">
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empleado / Sucursal</TableHead>
                      <TableHead>Acción / Aval</TableHead>
                      <TableHead>Periodo</TableHead>
                      <TableHead>Justificación</TableHead>
                      <TableHead>F. Solicitud</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Gestión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPermits.map((p) => (
                      <TableRow key={p.id} className={p.status === 'pending_admin' ? "bg-blue-50/40 border-l-4 border-l-blue-500 hover:bg-blue-100/40 transition-colors" : ""}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{p.employeeName}</span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase font-bold tracking-tight">
                              <Building className="h-2.5 w-2.5" /> {p.branch}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-[12px] text-primary truncate max-w-[150px]">{p.action}</span>
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">
                              {p.approvedBySupervisorAt ? `POR: ${p.supervisorName}` : `ESPERA: ${p.supervisorName}`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-[11px] font-mono whitespace-nowrap bg-zinc-50 px-2 py-1 rounded border">
                            {format(parseISO(p.startDate), 'dd/MM')} <ArrowRight className="h-2.5 w-2.5 mx-0.5 opacity-30" /> {format(parseISO(p.endDate), 'dd/MM')}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-start gap-2 cursor-help group">
                                <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                                <span className="text-[11px] text-zinc-600 line-clamp-2 leading-tight italic">
                                  {p.justification}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[300px] p-4 text-xs bg-zinc-900 text-zinc-50 border-none shadow-2xl z-50 rounded-xl">
                              <p className="font-black mb-2 uppercase text-[9px] text-primary tracking-widest border-b border-white/10 pb-1">Detalle del Motivo:</p>
                              <p className="leading-relaxed italic">"{p.justification}"</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500">
                            {p.requestDate ? format(parseISO(p.requestDate), 'dd/MM HH:mm') : '--'}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(p.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {p.evidenceFileDataUri ? (
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" onClick={() => setViewingEvidence(p.evidenceFileDataUri!)} title="Ver Justificante">
                                {p.evidenceFileDataUri.includes('type=image') ? <ImageIcon className="h-4 w-4" /> : <FileSearch className="h-4 w-4" />}
                              </Button>
                            ) : null}
                            
                            {(p.status === 'pending' || p.status === 'pending_admin') ? (
                              <div className="flex gap-1">
                                <Button size="sm" className="bg-primary hover:bg-primary/90 h-8 text-[11px] px-3 font-bold" onClick={() => handleOpenResolution(p, 'approved')}>
                                   Firmar
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleOpenResolution(p, 'rejected')}>
                                   <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button variant="outline" size="sm" className="h-8 gap-1 text-[11px] font-bold" onClick={() => handleDownloadPdf(p)}>
                                 <Download className="h-3 w-3" /> PDF
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
              <Scale className="h-10 w-10 opacity-10" />
              <p>No hay solicitudes pendientes ni registradas en este periodo.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOGO DE RESOLUCION */}
      <Dialog open={!!resolutionTarget} onOpenChange={(open) => !open && setResolutionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                {resolutionType === 'approved' ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                {resolutionType === 'approved' ? 'Aprobación Final Administrativa' : 'Rechazo de Solicitud'}
            </DialogTitle>
            <DialogDescription>
                Empleado: <strong>{resolutionTarget?.employeeName}</strong> | Trámite: <strong>{resolutionTarget?.action}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/30 p-4 rounded-xl border border-dashed text-xs space-y-2">
                <p className="font-bold text-zinc-600 uppercase tracking-widest border-b pb-1">Resumen del Expediente:</p>
                <p>• Aval Jefatura: <Badge variant="outline" className="h-4 text-[9px]">{resolutionTarget?.approvedBySupervisorAt ? "RECIBIDO ✅" : "POR ADMIN ⚠️"}</Badge></p>
                <p>• Justificación: <span className="italic">"{resolutionTarget?.justification}"</span></p>
                <p>• Periodo: <strong>{resolutionTarget?.startDate}</strong> al <strong>{resolutionTarget?.endDate}</strong></p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="notes" className="font-bold text-sm">Observaciones Administrativas</Label>
                <Textarea 
                    id="notes"
                    placeholder="Describe el motivo de la resolución final (opcional)..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    className="min-h-[120px] resize-none"
                />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResolutionTarget(null)}>Cancelar</Button>
            <Button 
                variant={resolutionType === 'approved' ? 'default' : 'destructive'}
                onClick={submitResolution}
                disabled={!!isProcessing}
                className="font-bold"
            >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Ejecutar Resolución
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VISOR DE JUSTIFICANTE */}
      <Dialog open={!!viewingEvidence} onOpenChange={(open) => !open && setViewingEvidence(null)}>
        <DialogContent className="max-w-4xl h-[95vh] flex flex-col p-0 overflow-hidden bg-zinc-100">
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between bg-white shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-primary" /> Visualización de Justificante Digital
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setViewingEvidence(null)} className="rounded-full">
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <div className="flex-1 relative overflow-auto p-4 sm:p-8">
            {viewingEvidence ? (
              (viewingEvidence.includes('type=image')) ? (
                <div className="flex justify-center items-start min-h-full">
                  <img src={viewingEvidence} alt="Justificante" className="max-w-full h-auto shadow-2xl rounded-xl border-4 border-white" />
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

      <div className="fixed top-[-9999px] left-[-9999px]">
        <div ref={pdfRef}>
          {printingPermit && <PermitPdfTemplate permit={printingPermit} />}
        </div>
      </div>
    </div>
  );
}
