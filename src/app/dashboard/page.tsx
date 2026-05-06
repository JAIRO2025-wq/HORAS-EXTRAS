
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import OvertimeTracker from '@/components/dashboard/overtime-tracker';
import { AttendanceTracker } from '@/components/dashboard/attendance-tracker';
import { PayStubsViewer } from '@/components/dashboard/pay-stubs-viewer';
import { PermitTracker } from '@/components/dashboard/permit-tracker';
import { NotificationBanner } from '@/components/dashboard/notification-banner';
import { NotificationCenter } from '@/components/dashboard/notification-center';
import { Home, Loader2, Clock, FileBadge, Scale, FileSearch, Timer, Calendar, Bell, MessageSquare, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Employee, OvertimeRecord, PermitRequest } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PermitForm } from '@/components/dashboard/permit-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('home');
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [records, setRecords] = useState<OvertimeRecord[]>([]);
  const [permits, setPermits] = useState<PermitRequest[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  const fetchNotifCount = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setUnreadNotifs(data.filter((n: any) => !n.read).length);
      }
    } catch (e) {}
  };

  const fetchData = useCallback(async (name: string, month: string) => {
    try {
        const [permitsRes, recordsRes] = await Promise.all([
            fetch(`/api/permits?user=${encodeURIComponent(name)}`),
            fetch(`/api/overtime/records?user=${encodeURIComponent(name)}&month=${encodeURIComponent(month)}`)
        ]);

        if (permitsRes.ok) {
            const data = await permitsRes.json();
            setPermits(data.filter((p: PermitRequest) => p.employeeName === name));
        }
        if (recordsRes.ok) {
            const data = await recordsRes.json();
            setRecords(data);
        }
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Manejar cambio de pestaña por eventos o URL
    const handleTabChange = (e: any) => setActiveTab(e.detail);
    window.addEventListener('change-tab', handleTabChange);
    
    // Revisar si venimos de una notificación push con un tab específico
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }

    const stored = localStorage.getItem('overtimeUser');
    if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        fetchData(parsed.name, parsed.month);
        fetchNotifCount();

        const interval = setInterval(() => {
          fetchData(parsed.name, parsed.month);
          fetchNotifCount();
        }, 30000);

        return () => {
          window.removeEventListener('change-tab', handleTabChange);
          clearInterval(interval);
        };
    }

    return () => {
      window.removeEventListener('change-tab', handleTabChange);
    };
  }, [fetchData]);

  // Cálculos para el resumen (Sin horas extra por política de integridad)
  const stats = useMemo(() => {
    const inasistencias = permits.filter(p => p.action === 'INASISTENCIA');
    const otrosPermisos = permits.filter(p => p.action !== 'INASISTENCIA');
    
    return {
        inasistenciasTotal: inasistencias.length,
        inasistenciasPendientes: inasistencias.filter(p => p.status === 'pending' || p.status === 'pending_admin').length,
        permisosTotal: otrosPermisos.length,
        permisosPendientes: otrosPermisos.filter(p => p.status === 'pending' || p.status === 'pending_admin').length
    };
  }, [permits]);

  const inasistenciasList = permits.filter(p => p.action === 'INASISTENCIA');

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="container mx-auto max-w-5xl space-y-6">
      <NotificationBanner />

      <Tabs value={activeTab} className="w-full">
        <TabsContent value="home" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="bg-primary text-primary-foreground border-none overflow-hidden relative">
                    <CardContent className="p-6">
                        <Home className="absolute -right-4 -top-4 h-24 w-24 opacity-10" />
                        <h3 className="text-2xl font-black mb-1">¡Hola, {user?.name.split(' ')[0]}!</h3>
                        <p className="text-sm opacity-90">Bienvenido a tu portal de gestión Flynet.</p>
                        <div className="mt-6 flex gap-2">
                            <Badge className="bg-white/20 hover:bg-white/30 border-none px-3 py-1">PERIODO: {user?.month}</Badge>
                        </div>
                    </CardContent>
                </Card>
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setActiveTab('notifications')} className="relative flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-primary/10 hover:border-primary transition-all">
                        {unreadNotifs > 0 && (
                          <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-black animate-bounce shadow-lg">
                            {unreadNotifs}
                          </span>
                        )}
                        <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center mb-2">
                            <Bell className="h-5 w-5 text-blue-600" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Mensajes</span>
                    </button>
                    <button onClick={() => setActiveTab('overtime')} className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-primary/10 hover:border-primary transition-all">
                        <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center mb-2">
                            <Timer className="h-5 w-5 text-amber-600" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Registrar Horas</span>
                    </button>
                </div>
            </div>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <Card className="border-primary/10">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-2">
                            <AlertCircle className="h-3 w-3 text-red-500" /> Mis Inasistencias
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-black">{stats.inasistenciasTotal}</div>
                        <p className="text-[10px] text-muted-foreground">{stats.inasistenciasPendientes} por justificar ante RRHH</p>
                    </CardContent>
                </Card>
                <Card className="border-primary/10">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-2">
                            <Scale className="h-3 w-3 text-blue-500" /> Trámites de Personal
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-black">{stats.permisosTotal}</div>
                        <p className="text-[10px] text-muted-foreground">{stats.permisosPendientes} solicitudes en trámite</p>
                    </CardContent>
                </Card>
            </div>

            <div className="bg-muted/30 p-6 rounded-2xl border-2 border-dashed flex flex-col items-center text-center">
                <div className="bg-primary/10 p-3 rounded-full mb-3">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-bold text-sm">Resumen de Actividad</h4>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                    Este es tu resumen para el periodo de {user?.month}. Asegúrate de que todos tus trámites y registros diarios estén al día.
                </p>
            </div>
        </TabsContent>

        <TabsContent value="notifications">
            <NotificationCenter />
        </TabsContent>

        <TabsContent value="attendance">
            <AttendanceTracker />
        </TabsContent>

        <TabsContent value="overtime">
            <OvertimeTracker />
        </TabsContent>

        <TabsContent value="inasistencias" className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold font-headline flex items-center gap-2">
                        <FileSearch className="h-6 w-6 text-red-600" /> Reporte de Faltas e Inasistencias
                    </h2>
                    <p className="text-sm text-muted-foreground">Registra y justifica tus ausencias laborales.</p>
                </div>
                <Button onClick={() => setIsFormOpen(true)} className="bg-red-600 hover:bg-red-700 text-white gap-2 w-full sm:w-auto h-11">
                    <FileSearch className="h-4 w-4" /> Reportar Falta
                </Button>
            </div>

            <div className="grid gap-4">
                {inasistenciasList.length > 0 ? inasistenciasList.map((inas) => (
                    <Card key={inas.id} className="border-l-4 border-l-red-500 overflow-hidden group hover:shadow-md transition-all">
                        <CardContent className="p-4 space-y-3">
                            <div className="flex flex-col md:flex-row justify-between gap-4">
                                <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-red-100 text-red-800 border-red-200">INASISTENCIA</Badge>
                                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-tight">{inas.eventuality}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-lg font-bold">
                                        <Calendar className="h-4 w-4 text-zinc-400" />
                                        {format(parseISO(inas.startDate), "eeee dd 'de' MMMM", { locale: es })}
                                    </div>
                                    <p className="text-sm text-muted-foreground italic leading-relaxed">"{inas.justification}"</p>
                                    
                                    {inas.adminNotes && (
                                      <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100 animate-in slide-in-from-top-2 duration-300">
                                        <div className="flex items-center gap-2 mb-1">
                                          <MessageSquare className="h-3 w-3 text-amber-600" />
                                          <span className="text-[10px] font-black uppercase text-amber-700 tracking-widest">Respuesta de RRHH</span>
                                        </div>
                                        <p className="text-sm text-amber-900 font-medium">{inas.adminNotes}</p>
                                      </div>
                                    )}
                                </div>
                                <div className="flex flex-col items-start sm:items-end justify-between">
                                    <div className="text-left sm:text-right">
                                        <p className="text-[10px] font-black uppercase text-zinc-400">Estado Final</p>
                                        <Badge variant={inas.status === 'approved' ? 'secondary' : inas.status === 'rejected' ? 'destructive' : 'outline'} className="mt-1">
                                            {inas.status === 'approved' ? 'Justificada' : inas.status === 'rejected' ? 'Injustificada' : 'En Revisión'}
                                        </Badge>
                                    </div>
                                    {inas.evidenceFileDataUri && (
                                        <div className="mt-2 text-[9px] bg-muted px-2 py-1 rounded-full flex items-center gap-1.5 text-zinc-500">
                                            <FileBadge className="h-3 w-3" /> EVIDENCIA ADJUNTA
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )) : (
                    <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-xl flex flex-col items-center">
                        <FileSearch className="h-12 w-12 opacity-10 mb-4" />
                        <p className="text-muted-foreground font-medium">No tienes inasistencias reportadas.</p>
                        <p className="text-xs text-muted-foreground">¡Excelente puntualidad!</p>
                    </div>
                )}
            </div>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-3xl p-0 max-h-[95vh] overflow-y-auto">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Reportar Inasistencia</DialogTitle>
                        <DialogDescription>Completa los datos de tu falta.</DialogDescription>
                    </DialogHeader>
                    <PermitForm 
                        defaultAction="INASISTENCIA" 
                        onSuccess={() => {
                            setIsFormOpen(false);
                            if (user) fetchData(user.name, user.month);
                        }} 
                    />
                </DialogContent>
            </Dialog>
        </TabsContent>

        <TabsContent value="paystubs">
            <PayStubsViewer />
        </TabsContent>

        <TabsContent value="permits">
            <PermitTracker />
        </TabsContent>
      </Tabs>
    </div>
  );
}
