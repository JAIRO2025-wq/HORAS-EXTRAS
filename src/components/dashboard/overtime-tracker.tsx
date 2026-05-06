
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, CloudOff, Timer, ShieldCheck, Info, CheckCircle2 } from 'lucide-react';
import { AddHoursForm } from './add-hours-form';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { OvertimeRecord } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { OfflineManager } from '@/lib/offline-manager';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function OvertimeTracker() {
  const [records, setRecords] = useState<OvertimeRecord[]>([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; month: string } | null>(
    null
  );
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
    const storedUser = localStorage.getItem('overtimeUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    if (user && isClient) {
      const fetchRecords = async () => {
        try {
          const response = await fetch(
            `/api/overtime/records?user=${encodeURIComponent(
              user.name
            )}&month=${encodeURIComponent(user.month)}`
          );
          if (!response.ok) {
            throw new Error('Failed to fetch records');
          }
          const data = await response.json();
          if (Array.isArray(data)) {
            const parsedRecords = data.map((rec: OvertimeRecord) => ({
              ...rec,
              date: new Date(rec.date),
            }));
            setRecords(parsedRecords);
          }
        } catch (error) {
          console.error('Error fetching records:', error);
          setRecords([]);
        }
      };
      fetchRecords();
    }
  }, [user, isClient]);

  const addRecord = async (newRecord: OvertimeRecord) => {
    if (!user) return;

    // Guardamos localmente para validación de traslape, pero no se mostrarán en lista
    setRecords((prev) => [...prev, newRecord]);

    const url = `/api/overtime/records?user=${encodeURIComponent(user.name)}&month=${encodeURIComponent(user.month)}`;
    
    const successTitle = "¡Registro de Jornada Exitoso!";
    const successMessage = `Se han contabilizado ${newRecord.totalHours.toFixed(2)} horas correspondientes al día ${format(newRecord.date, "dd 'de' MMMM", { locale: es })} en el horario de ${newRecord.startTime} a ${newRecord.endTime}. La información ha sido remitida al sistema central; se integrará automáticamente a la planilla principal posterior a su validación reglamentaria.`;

    if (!navigator.onLine) {
      OfflineManager.saveAction({
        url,
        method: 'POST',
        body: newRecord,
        description: `Horas Extra: ${newRecord.activity.substring(0, 20)}...`
      });
      toast({
        title: 'Guardado Offline',
        description: 'No tienes internet. El registro se enviará automáticamente al detectar conexión.',
        icon: <CloudOff className="h-4 w-4" />
      });
      return;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord),
      });

      if (!response.ok) throw new Error('Error en servidor');

      toast({
        title: successTitle,
        description: successMessage,
        className: "bg-green-50 border-green-200 text-green-900",
      });
    } catch (error) {
      console.error('Error saving record:', error);
      toast({
        variant: 'destructive',
        title: 'Error al Guardar',
        description: 'No se pudo procesar tu registro. Por favor intenta de nuevo.',
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline flex items-center gap-2">
            <Timer className="h-6 w-6 text-primary" />
            Registro de Horas Extra
          </h2>
          <p className="text-sm text-muted-foreground">Reporta tus jornadas extraordinarias para el periodo de {user?.month}.</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="border-2 border-primary/10 shadow-lg bg-gradient-to-br from-background to-primary/5 overflow-hidden">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
                <Timer className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl font-black">Panel de Declaración de Jornada</CardTitle>
            <CardDescription className="max-w-md mx-auto">
                Utiliza el botón inferior para registrar las horas laboradas fuera de tu horario habitual.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center p-8">
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                <Button
                    size="lg"
                    className="h-16 px-8 gap-3 text-lg font-bold shadow-xl shadow-primary/20 animate-pulse hover:animate-none transition-all"
                >
                    <PlusCircle className="h-6 w-6" />
                    Registrar Nueva Jornada
                </Button>
                </SheetTrigger>
                <SheetContent className="flex flex-col w-full sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>Declaración de Horas Extra</SheetTitle>
                    <SheetDescription>
                    Completa la información técnica de tu jornada para {user?.month}.
                    </SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-hidden">
                    <AddHoursForm
                    onRecordAdded={addRecord}
                    closeSheet={() => setIsSheetOpen(false)}
                    existingRecords={records}
                    />
                </div>
                </SheetContent>
            </Sheet>

            <div className="mt-12 w-full max-w-lg space-y-4">
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl border border-dashed">
                    <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                        <p className="font-bold text-zinc-700 uppercase tracking-wider">Protocolo de Integridad</p>
                        <p className="text-muted-foreground leading-relaxed">
                            Por políticas de seguridad, los registros enviados no son editables ni visibles por el colaborador una vez remitidos. Toda la información es procesada directamente por el departamento de administración y auditoría.
                        </p>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl border border-dashed">
                    <Info className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                        <p className="font-bold text-zinc-700 uppercase tracking-wider">Validación de Datos</p>
                        <p className="text-muted-foreground leading-relaxed">
                            Asegúrate de que la fecha, horario y descripción de la actividad sean correctos antes de guardar. El sistema detectará automáticamente cualquier traslape de horarios.
                        </p>
                    </div>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
