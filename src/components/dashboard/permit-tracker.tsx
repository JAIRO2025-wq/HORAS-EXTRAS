'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  PlusCircle, 
  FileClock, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2, 
  ClipboardCheck,
  UserCheck,
  ArrowRight,
  ShieldCheck,
  Download,
  FileSearch,
  MessageSquare,
  Eye,
  X,
  Image as ImageIcon
} from 'lucide-react';
import { PermitForm } from './permit-form';
import type { PermitRequest } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PermitPdfTemplate } from '@/components/admin/permit-pdf-template';
import { useToast } from '@/hooks/use-toast';
import { PdfViewer } from '@/components/ui/pdf-viewer';

export function PermitTracker() {
  const [permits, setPermits] = useState<PermitRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; month: string } | null>(null);
  const [viewingEvidence, setViewingEvidence] = useState<string | null>(null);
  const { toast } = useToast();

  // Estados para PDF
  const [printingPermit, setPrintingPermit] = useState<PermitRequest | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const fetchPermits = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/permits?user=${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        setPermits(data.sort((a: any, b: any) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()));
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
      const parsed = JSON.parse(stored);
      setUser(parsed);
      fetchPermits(parsed.name);
    }
  }, [fetchPermits]);

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch('/api/permits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      if (res.ok) {
        toast({ title: status === 'approved' ? 'Visto Bueno Registrado' : 'Solicitud Rechazada' });
        if (user) fetchPermits(user.name);
      }
    } catch (e) {
      console.error(e);
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
        pdf.save(`Mi_Accion_Personal_${permit.action}.pdf`);
        toast({ title: "Descarga completada" });
      } catch (error) {
        console.error("PDF Error:", error);
      } finally {
        setPrintingPermit(null);
      }
    }, 500);
  };

  const myRequests = permits.filter(p => p.employeeName === user?.name);
  const pendingForMe = permits.filter(p => p.supervisorName === user?.name && p.status === 'pending');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 gap-1"><CheckCircle2 className="h-3 w-3" /> Aprobado Final</Badge>;
      case 'rejected': return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rechazado</Badge>;
      case 'pending_admin': return <Badge className="bg-blue-50 text-blue-700 border-blue-100 gap-1"><ShieldCheck className="h-3 w-3" /> Avalado (Espera Admin)</Badge>;
      default: return <Badge variant="outline" className="opacity-60 gap-1"><Clock className="h-3 w-3" /> Esperando mi Aval</Badge>;
    }
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-headline">Gestión de Permisos</h2>
          <p className="text-sm text-muted-foreground">Solicita y gestiona tus acciones de personal.</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="gap-2 shadow-lg bg-accent text-accent-foreground hover:bg-accent/90 w-full sm:w-auto h-11">
          <PlusCircle className="h-4 w-4" /> Nueva Solicitud
        </Button>
      </div>

      <Tabs defaultValue="my-permits" className="w-full">
        <TabsList className="grid grid-cols-2 w-full sm:w-[400px]">
          <TabsTrigger value="my-permits" className="gap-2">
            <FileClock className="h-4 w-4" /> Mis Solicitudes
          </TabsTrigger>
          <TabsTrigger value="to-approve" className="gap-2 relative">
            <UserCheck className="h-4 w-4" /> Autorizar
            {pendingForMe.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white animate-pulse">
                {pendingForMe.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-permits" className="mt-6">
          <div className="grid gap-4">
            {myRequests.length > 0 ? myRequests.map(p => (
              <Card key={p.id} className="overflow-hidden border-l-4 border-l-primary group hover:shadow-md transition-all">
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-bold text-primary">{p.action}</span>
                        {getStatusBadge(p.status)}
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-xs text-muted-foreground font-medium">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Solicitado: {format(parseISO(p.requestDate), "dd/MM/yy")}</span>
                        <div className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded">
                            {format(parseISO(p.startDate), "dd/MM")} <ArrowRight className="h-3 w-3 mx-1" /> {format(parseISO(p.endDate), "dd/MM")}
                        </div>
                      </div>
                      <p className="text-sm italic text-zinc-600">"{p.justification}"</p>
                      
                      {p.adminNotes && (
                        <div className="mt-2 p-3 bg-blue-50/50 rounded-lg border border-blue-100 animate-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2 mb-1">
                                <MessageSquare className="h-3 w-3 text-blue-600" />
                                <span className="text-[10px] font-black uppercase text-blue-700 tracking-widest">Respuesta de RRHH</span>
                            </div>
                            <p className="text-sm text-blue-900 font-medium">{p.adminNotes}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-start sm:items-end justify-center gap-2">
                        <div className="flex gap-2">
                          {p.evidenceFileDataUri && (
                            <Button variant="secondary" size="sm" className="h-8 gap-2 bg-amber-50 text-amber-700 hover:bg-amber-100" onClick={() => setViewingEvidence(p.evidenceFileDataUri!)}>
                                {p.evidenceFileDataUri.includes('type=image') ? <ImageIcon className="h-3.5 w-3.5" /> : <FileSearch className="h-3.5 w-3.5" />}
                                Justificante
                            </Button>
                          )}
                          {(p.status === 'approved' || p.status === 'rejected') && (
                              <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => handleDownloadPdf(p)}>
                                  <Download className="h-3 w-3" /> PDF
                              </Button>
                          )}
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] uppercase font-black text-muted-foreground block">Jefe que Avala</span>
                            <span className="text-xs font-bold">{p.supervisorName}</span>
                        </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-xl">
                <FileClock className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">No has realizado ninguna solicitud todavía.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="to-approve" className="mt-6">
          <div className="grid gap-4">
            {pendingForMe.length > 0 ? pendingForMe.map(p => (
              <Card key={p.id} className="border-2 border-amber-200 bg-amber-50/30">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <div>
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 mb-2">ESPERANDO TU VISTO BUENO</Badge>
                            <CardTitle className="text-lg">{p.employeeName}</CardTitle>
                            <CardDescription>Solicita: <span className="font-bold text-foreground">{p.action}</span></CardDescription>
                        </div>
                        <div className="text-right hidden sm:block">
                            <p className="text-xs font-bold text-muted-foreground uppercase">Periodo</p>
                            <p className="text-sm font-mono">{format(parseISO(p.startDate), "dd/MM/yy")} al {format(parseISO(p.endDate), "dd/MM/yy")}</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-white p-3 rounded border text-sm italic">
                        "{p.justification}"
                    </div>
                    
                    {p.evidenceFileDataUri && (
                      <div className="flex items-center gap-3 p-3 bg-white rounded border border-dashed border-amber-300">
                        {p.evidenceFileDataUri.includes('type=image') ? <ImageIcon className="h-5 w-5 text-amber-600" /> : <FileSearch className="h-5 w-5 text-amber-600" />}
                        <span className="text-xs font-bold flex-1">
                          {p.evidenceFileDataUri.includes('type=image') ? 'Fotografía adjunta' : 'Evidencia PDF adjunta'}
                        </span>
                        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => setViewingEvidence(p.evidenceFileDataUri!)}>
                          <Eye className="h-3 w-3" /> Revisar {p.evidenceFileDataUri.includes('type=image') ? 'Imagen' : 'PDF'}
                        </Button>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button className="flex-1 bg-green-600 hover:bg-green-700 gap-2" onClick={() => handleAction(p.id, 'approved')}>
                            <CheckCircle2 className="h-4 w-4" /> Dar Visto Bueno (Aval)
                        </Button>
                        <Button variant="destructive" className="flex-1 gap-2" onClick={() => handleAction(p.id, 'rejected')}>
                            <XCircle className="h-4 w-4" /> Rechazar
                        </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic text-center">
                      * Al dar el Visto Bueno, la solicitud será remitida a Administración para su aprobación final.
                    </p>
                </CardContent>
              </Card>
            )) : (
              <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-xl">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">No tienes solicitudes pendientes de avalar.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Nueva Solicitud de Permiso</DialogTitle>
            <DialogDescription>Formulario oficial para trámites de Recursos Humanos.</DialogDescription>
          </DialogHeader>
          <PermitForm onSuccess={() => {
            setIsFormOpen(false);
            if (user) fetchPermits(user.name);
          }} />
        </DialogContent>
      </Dialog>

      {/* VISOR DE JUSTIFICANTE CON DETECCION DE TIPO MEJORADA */}
      <Dialog open={!!viewingEvidence} onOpenChange={(open) => !open && setViewingEvidence(null)}>
        <DialogContent className="max-w-4xl h-[95vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between bg-white shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-primary" /> Justificante de Ausencia
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setViewingEvidence(null)} className="rounded-full">
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <div className="flex-1 relative bg-zinc-50 overflow-auto">
            {viewingEvidence && (
              (viewingEvidence.startsWith('data:image/') || viewingEvidence.includes('type=image')) ? (
                <div className="p-4 flex justify-center items-start min-h-full">
                  <img src={viewingEvidence} alt="Justificante" className="max-w-full h-auto shadow-2xl rounded-lg" />
                </div>
              ) : (
                <PdfViewer file={viewingEvidence} />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* CONTENEDOR OCULTO PARA PDF */}
      <div className="fixed top-[-9999px] left-[-9999px]">
        <div ref={pdfRef}>
          {printingPermit && <PermitPdfTemplate permit={printingPermit} />}
        </div>
      </div>
    </div>
  );
}
