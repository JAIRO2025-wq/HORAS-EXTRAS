'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
import { TooltipContent } from '@radix-ui/react-tooltip';

const ITEMS_PER_PAGE = 5;

export default function AdminPermitsPage() {
  const [permits, setPermits] = useState<PermitRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [adminData, setAdminData] = useState<any>(null);
  const { toast } = useToast();

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);

  // Fechas para exportar - DIVIDIDAS para mejor UI
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

  useEffect(() => {
    const stored = localStorage.getItem('overtimeAdmin');
    if (stored) setAdminData(JSON.parse(stored));
    fetchPermits();
  }, []);

  const fetchPermits = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/permits');
      if (res.ok) {
        const data = await res.json();
        setPermits(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!dateFrom || !dateTo) {
        toast({ variant: 'destructive', title: 'Fechas inválidas', description: 'Por favor selecciona ambas fechas para el reporte.' });
        return;
    }
    if (isAfter(dateFrom, dateTo)) {
        toast({ variant: 'destructive', title: 'Rango inválido', description: 'La fecha "Desde" no puede ser posterior a la fecha "Hasta".' });
        return;
    }

    try {
        const query = `?from=${dateFrom.toISOString()}&to=${dateTo.toISOString()}`;
        const res = await fetch(`/api/permits${query}`);
        if (res.ok) {
            const data: PermitRequest[] = await res.json();
            if(data.length === 0){
              toast({ title: "Sin registros", description: "No se encontraron permisos en este rango." });
              return;
            }
            exportToExcel(data, `Reporte_Permisos_${format(dateFrom, 'yyyy-MM-dd')}_a_${format(dateTo, 'yyyy-MM-dd')}`);
            toast({ title: "Excel generado", description: "El reporte se ha descargado con éxito." });
        } else {
          toast({ variant: 'destructive', title: 'Error servidor', description: 'No se pudo obtener la información de exportación.' });
        }
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error inesperado', description: 'Falló el proceso de exportación.' });
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
        fetchPermits();
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
                    Validación de Acciones de Personal
                </h1>
                <p className="text-muted-foreground text-sm">Prioridad a solicitudes con firma pendiente de administración.</p>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
                <Button variant="outline" onClick={() => { fetchPermits(); setCurrentPage(1); }} disabled={isLoading} className="w-full sm:w-auto">
                    <Clock className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Actualizar
                </Button>
            </div>
        </div>

        <Card>
            <CardHeader className="border-b bg-muted/5 p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <CardTitle className="text-sm font-bold uppercase text-zinc-500 tracking-wider">Reportes en Excel</CardTitle>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                        {/* SELECTORES DIVIDIDOS PARA MEJOR UI */}
                        <div className="flex items-center gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full sm:w-[150px] justify-start text-left font-normal h-10", !dateFrom && "text-muted-foreground")}>
                                        <CalendarDays className="mr-2 h-4 w-4 text-primary" />
                                        {dateFrom ? format(dateFrom, "dd/MM/yyyy") : <span>Desde</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus locale={es} />
                                </PopoverContent>
                            </Popover>
                            <span className="text-xs font-bold text-muted-foreground">al</span>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full sm:w-[150px] justify-start text-left font-normal h-10", !dateTo && "text-muted-foreground")}>
                                        <CalendarDays className="mr-2 h-4 w-4 text-primary" />
                                        {dateTo ? format(dateTo, "dd/MM/yyyy") : <span>Hasta</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus locale={es} />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <Button onClick={handleExport} disabled={isLoading} className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto h-10 gap-2 shadow-md">
                            <FileDown className="h-4 w-4"/> Descargar Excel
                        </Button>
                    </div>
                </div>
            </CardHeader>
        </Card>

      <Card>
        <CardHeader className="pb-2 border-b bg-muted/5">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Buzón de Solicitudes</CardTitle>
            {totalPages > 1 && (
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-muted-foreground">Página {currentPage} de {totalPages}</span>
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
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Cargando trámites...</p>
            </div>
          ) : permits.length > 0 ? (
            <div className="overflow-x-auto">
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empleado / Sucursal</TableHead>
                      <TableHead>Acción / Jefe que Avala</TableHead>
                      <TableHead>Periodo</TableHead>
                      <TableHead>Justificación</TableHead>
                      <TableHead>Fecha Registro</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Decisión Final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPermits.map((p) => (
                      <TableRow key={p.id} className={p.status === 'pending_admin' ? "bg-blue-50/40 border-l-4 border-l-blue-500" : ""}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{p.employeeName}</span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase">
                              <Building className="h-3 w-3" /> {p.branch}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-[12px] text-primary">{p.action}</span>
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">
                              {p.approvedBySupervisorAt ? `AVALADO POR: ${p.supervisorName}` : `ESPERA A: ${p.supervisorName}`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-[11px] font-mono whitespace-nowrap">
                            {format(parseISO(p.startDate), 'dd/MM/yy')} <ArrowRight className="h-3 w-3 mx-1 opacity-50" /> {format(parseISO(p.endDate), 'dd/MM/yy')}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-start gap-2 cursor-help group">
                                <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                                <span className="text-[11px] text-zinc-600 line-clamp-2 leading-tight">
                                  {p.justification}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[300px] p-3 text-xs bg-zinc-900 text-zinc-50 border-none shadow-2xl z-50">
                              <p className="font-black mb-1.5 uppercase text-[9px] text-primary tracking-widest border-b border-white/10 pb-1">Justificación del Trámite:</p>
                              <p className="leading-relaxed italic">"{p.justification}"</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-600 bg-zinc-100 px-2 py-1 rounded w-fit">
                            <History className="h-3 w-3" />
                            {p.requestDate ? format(parseISO(p.requestDate), 'dd/MM/yy HH:mm:ss') : '--'}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(p.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {p.evidenceFileDataUri ? (
                              <Button variant="outline" size="sm" className="h-8 gap-1 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" onClick={() => setViewingEvidence(p.evidenceFileDataUri!)}>
                                {p.evidenceFileDataUri.includes('type=image') ? <ImageIcon className="h-3 w-3" /> : <FileSearch className="h-3 w-3" />}
                                Ver Doc
                              </Button>
                            ) : null}
                            
                            {(p.status === 'pending' || p.status === 'pending_admin') ? (
                              <div className="flex gap-1">
                                <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8 text-[11px] px-3 font-bold" onClick={() => handleOpenResolution(p, 'approved')}>
                                   Firmar
                                </Button>
                                <Button size="sm" variant="destructive" className="h-8 text-[11px] px-3 font-bold" onClick={() => handleOpenResolution(p, 'rejected')}>
                                   X
                                </Button>
                              </div>
                            ) : (
                              <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleDownloadPdf(p)}>
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
              <p>No se encontraron solicitudes registradas.</p>
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
            <div className="bg-muted/30 p-3 rounded-lg border border-dashed text-xs space-y-1">
                <p className="font-bold text-zinc-600 uppercase tracking-widest">Resumen de Validación:</p>
                <p>• Aval de Jefe: {resolutionTarget?.approvedBySupervisorAt ? "RECIBIDO ✅" : "POR ADMINISTRACIÓN ⚠️"}</p>
                <p>• Motivo: "{resolutionTarget?.justification}"</p>
                <p>• Registrado el: {resolutionTarget?.requestDate ? format(parseISO(resolutionTarget.requestDate), "dd/MM/yyyy HH:mm:ss") : '--'}</p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="notes">Observaciones para el Expediente</Label>
                <Textarea 
                    id="notes"
                    placeholder="Describe el motivo de la resolución final..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    className="min-h-[100px] resize-none"
                />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResolutionTarget(null)}>Cancelar</Button>
            <Button 
                variant={resolutionType === 'approved' ? 'default' : 'destructive'}
                onClick={submitResolution}
                disabled={!!isProcessing}
            >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Finalizar Dictamen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VISOR DE JUSTIFICANTE */}
      <Dialog open={!!viewingEvidence} onOpenChange={(open) => !open && setViewingEvidence(null)}>
        <DialogContent className="max-w-4xl h-[95vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between bg-white shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-primary" /> Visualización de Evidencia Digital
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setViewingEvidence(null)} className="rounded-full">
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <div className="flex-1 relative bg-zinc-50 overflow-auto">
            {viewingEvidence ? (
              (viewingEvidence.includes('type=image')) ? (
                <div className="p-4 flex justify-center items-start min-h-full">
                  <img src={viewingEvidence} alt="Justificante" className="max-w-full h-auto shadow-2xl rounded-lg" />
                </div>
              ) : (
                <PdfViewer file={viewingEvidence} />
              )
            ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-xs font-bold uppercase">Cargando archivo...</p>
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
