'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LogIn, LogOut, Loader2, Calendar, ShieldAlert, Laptop, CloudOff, WifiOff, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AttendanceRecord, Branch, Employee } from '@/lib/types';
import { OfflineManager } from '@/lib/offline-manager';
import Image from 'next/image';
import { months } from '@/lib/data';
import { cn } from '@/lib/utils';

export function AttendanceTracker() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [user, setUser] = useState<{ name: string; month: string } | null>(null);
  const [me, setMe] = useState<Employee | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [localDeviceId, setLocalDeviceId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setLocalDeviceId(localStorage.getItem('overtimeDeviceId'));
    
    const storedUser = localStorage.getItem('overtimeUser');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      fetchInitialData(parsed.name, parsed.month);
    }

    const checkStatus = () => setIsOfflineMode(!navigator.onLine);
    window.addEventListener('online', checkStatus);
    window.addEventListener('offline', checkStatus);
    checkStatus();

    return () => {
      window.removeEventListener('online', checkStatus);
      window.removeEventListener('offline', checkStatus);
    };
  }, []);

  const fetchInitialData = async (name: string, month: string) => {
    setIsLoading(true);
    try {
      const [attRes, empRes, branchRes] = await Promise.all([
        fetch(`/api/attendance?user=${encodeURIComponent(name)}&month=${encodeURIComponent(month)}`),
        fetch('/api/employees'),
        fetch('/api/branches')
      ]);

      if (attRes.ok) {
        const attData = await attRes.json();
        setRecords(attData.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      }

      if (empRes.ok && branchRes.ok) {
        const emps: Employee[] = await empRes.json();
        const branches: Branch[] = await branchRes.json();
        const foundMe = emps.find(e => e.name === name);
        if (foundMe) {
          setMe(foundMe);
          const myBranch = branches.find(b => b.name === foundMe.branch);
          if (myBranch) setBranch(myBranch);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // FILTRO ESTRICTO: Solo mostrar registros de asistencia que pertenezcan al mes calendario seleccionado
  const filteredRecords = useMemo(() => {
    if (!user) return records;
    const selectedMonthIndex = months.indexOf(user.month);
    return records.filter(rec => {
        const recDate = parseISO(rec.timestamp);
        return recDate.getMonth() === selectedMonthIndex;
    });
  }, [records, user]);

  const isAuthorizedDevice = useMemo(() => {
    if (!branch) return false;
    if (branch.isUnrestricted) return true;
    if (!branch.deviceId || !localDeviceId) return false;
    return branch.deviceId === localDeviceId;
  }, [branch, localDeviceId]);

  const canAuthorize = useMemo(() => {
    return branch && !branch.isUnrestricted && !branch.deviceId;
  }, [branch]);

  const todayRecords = useMemo(() => {
    const today = new Date();
    return records.filter(r => isSameDay(new Date(r.timestamp), today));
  }, [records]);

  const hasEnteredToday = todayRecords.some(r => r.type === 'in');
  const hasExitedToday = todayRecords.some(r => r.type === 'out');

  const handleMarkAttendance = async (type: 'in' | 'out') => {
    if (!user || !branch || !me) return;

    if (!isAuthorizedDevice) {
        toast({ variant: 'destructive', title: 'Error de Dispositivo', description: 'Este equipo no está autorizado para marcar.' });
        return;
    }

    if ((type === 'in' && hasEnteredToday) || (type === 'out' && hasExitedToday)) {
        toast({ variant: 'destructive', title: 'Ya registrado', description: 'Ya has realizado esta marca hoy.' });
        return;
    }

    const now = new Date();
    const url = `/api/attendance?user=${encodeURIComponent(user.name)}&month=${encodeURIComponent(user.month)}&branch=${encodeURIComponent(branch.name)}`;
    const body = { type, employeeId: me.id };

    if (!navigator.onLine) {
      const tempRecord: AttendanceRecord = {
        id: crypto.randomUUID(),
        timestamp: now.toISOString(),
        type,
        deviceInfo: 'Offline Token Save',
        employeeName: user.name,
        employeeId: me.id,
        branch: branch.name,
        date: now.toISOString().split('T')[0]
      };
      
      setRecords(prev => [tempRecord, ...prev]);
      OfflineManager.saveAction({
        url,
        method: 'POST',
        body,
        description: `Marca Offline (${type === 'in' ? 'Entrada' : 'Salida'})`
      });

      toast({
        title: 'Marca Guardada Offline',
        description: 'Se sincronizará al detectar conexión.',
        icon: <CloudOff className="h-4 w-4" />
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Error al registrar');
      
      const newRecord = await response.json();
      setRecords(prev => [newRecord, ...prev]);
      toast({ title: `¡${type === 'in' ? 'Entrada' : 'Salida'} Exitosa!`, description: `Registrada a las ${format(now, 'HH:mm')}` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error de Red', description: 'No se pudo conectar con el servidor.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAuthorize = async () => {
    if (!branch || !navigator.onLine) {
      toast({ variant: 'destructive', title: 'Error', description: 'Se requiere internet para la vinculación inicial.' });
      return;
    }
    setIsProcessing(true);
    const newDeviceId = crypto.randomUUID();
    try {
      const response = await fetch('/api/branches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: branch.id, deviceId: newDeviceId }),
      });
      if (!response.ok) throw new Error('Could not authorize.');
      localStorage.setItem('overtimeDeviceId', newDeviceId);
      setLocalDeviceId(newDeviceId);
      setBranch(prev => prev ? { ...prev, deviceId: newDeviceId } : null);
      toast({ title: 'Dispositivo Vinculado', description: 'Este equipo es ahora el oficial para esta sucursal.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Fallo al autorizar el equipo.' });
    } finally {
      setIsProcessing(false);
      setIsAuthDialogOpen(false);
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="grid gap-6 md:grid-cols-2 animate-in fade-in duration-500">
      <div className="space-y-6">
        <Card className="border-2 border-primary/20 shadow-xl overflow-hidden bg-background">
            <CardHeader className="bg-primary/5 pb-8 border-b">
                <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-headline flex items-center gap-2">
                        <Lock className="h-5 w-5 text-primary" />
                        Reloj de Sucursal
                      </CardTitle>
                      <CardDescription className="font-bold uppercase tracking-tight">{branch?.name}</CardDescription>
                    </div>
                    <div className="bg-primary/10 p-3 rounded-full">
                        <Image src="/reloj.ico" alt="Clock" width={32} height={32} className="h-8 w-8 object-contain" />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-8">
                {isOfflineMode && (
                  <div className="mb-4">
                    <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800">
                      <WifiOff className="h-4 w-4" />
                      <AlertTitle>Modo Sin Conexión</AlertTitle>
                      <AlertDescription>Las marcas se guardarán localmente con sello de tiempo real.</AlertDescription>
                    </Alert>
                  </div>
                )}

                {(!branch?.isUnrestricted && !isAuthorizedDevice) ? (
                    <div className="space-y-4 py-6 text-center">
                        <div className="bg-destructive/10 p-4 rounded-xl inline-block mb-2">
                            <ShieldAlert className="h-12 w-12 text-destructive" />
                        </div>
                        <h3 className="text-lg font-bold">Dispositivo no Autorizado</h3>
                        <p className="text-sm text-muted-foreground px-4">Esta sucursal solo permite marcar desde el equipo oficial registrado por administración.</p>
                        {canAuthorize && (
                          <Button 
                            className="w-full mt-4 gap-2 h-12" 
                            onClick={() => setIsAuthDialogOpen(true)}
                            disabled={isOfflineMode}
                          >
                            <Laptop className="h-4 w-4" />
                            {isOfflineMode ? 'Conéctate para Autorizar' : 'Autorizar este Equipo'}
                          </Button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Button size="lg" className="h-32 flex-col gap-2 bg-green-600 hover:bg-green-700 shadow-lg border-b-4 border-green-800 active:border-b-0" disabled={hasEnteredToday || isProcessing} onClick={() => handleMarkAttendance('in')}>
                                {isProcessing && !hasEnteredToday ? <Loader2 className="animate-spin" /> : <LogIn className="h-12 w-12" />}
                                <span className="font-bold uppercase text-xs tracking-widest">Entrada</span>
                            </Button>
                            <Button size="lg" variant="destructive" className="h-32 flex-col gap-2 shadow-lg border-b-4 border-red-800 active:border-b-0" disabled={!hasEnteredToday || hasExitedToday || isProcessing} onClick={() => handleMarkAttendance('out')}>
                                {isProcessing && hasEnteredToday && !hasExitedToday ? <Loader2 className="animate-spin" /> : <LogOut className="h-12 w-12" />}
                                <span className="font-bold uppercase text-xs tracking-widest">Salida</span>
                            </Button>
                        </div>
                        <p className="text-[10px] text-center text-muted-foreground mt-4 italic">
                            Dispositivo Token: {localDeviceId?.substring(0, 8)}... {branch?.isUnrestricted ? '(Acceso Libre)' : '(Equipo Oficial)'}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>

      <Card className="bg-background">
        <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Historial de {user?.month}
            </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {filteredRecords.length > 0 ? filteredRecords.slice(0, 31).map((rec) => (
                    <div key={rec.id} className="flex items-center justify-between p-3 border rounded-xl bg-muted/5 hover:bg-muted/10 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-full", rec.type === 'in' ? "bg-green-100" : "bg-blue-100")}>
                                {rec.type === 'in' ? <LogIn className="h-4 w-4 text-green-600" /> : <LogOut className="h-4 w-4 text-blue-600" />}
                            </div>
                            <div>
                                <p className="font-bold text-sm">{rec.type === 'in' ? 'ENTRADA' : 'SALIDA'}</p>
                                <p className="text-[10px] text-muted-foreground font-mono uppercase">
                                    {format(new Date(rec.timestamp), "eeee dd MMM, HH:mm:ss", { locale: es })}
                                </p>
                            </div>
                        </div>
                        {rec.deviceInfo?.includes('Offline') && <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-800 animate-pulse">SYNC PENDIENTE</Badge>}
                    </div>
                )) : (
                  <div className="text-center py-20 text-muted-foreground italic flex flex-col items-center">
                    <Calendar className="h-12 w-12 opacity-10 mb-4" />
                    <p>No se encontraron marcas de {user?.month}.</p>
                  </div>
                )}
            </div>
        </CardContent>
      </Card>

      <AlertDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Autorizar Dispositivo Único</AlertDialogTitle>
                <AlertDialogDescription>
                    ¿Estás seguro de registrar este dispositivo como el **único equipo autorizado** para marcar asistencia en la sucursal <strong>{branch?.name}</strong>?
                    <br/><br/>
                    Esta acción restringirá el acceso desde cualquier otro celular o computadora.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleAuthorize} className="bg-primary text-primary-foreground">Sí, Vincular ahora</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
