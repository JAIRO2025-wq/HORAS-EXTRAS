'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO, startOfDay, isAfter, getDaysInMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Send, UserX, Upload, CheckCircle2, X, FileSearch,
  Image as ImageIcon, Info, CalendarDays, AlertTriangle,
} from 'lucide-react';
import type { Employee } from '@/lib/types';
import { months } from '@/lib/data';

const REASONS = [
  'SALUD / ENFERMEDAD',
  'TRÁMITE LEGAL / PERSONAL',
  'PROBLEMA DE TRANSPORTE',
  'CALAMIDAD DOMÉSTICA',
  'DUELO',
  'FUERZA MAYOR (LLUVIA, BLOQUEO)',
  'ABANDONO DE PUESTO',
  'SIN JUSTIFICANTE / NO SE PRESENTÓ',
  'OTRO...',
];

const FormSchema = z.object({
  employeeName: z.string().min(1, 'Debe seleccionar un colaborador'),
  absenceDate: z.string().min(1, 'Debe seleccionar la fecha de la falta'),
  reason: z.string().min(1, 'Debe seleccionar un motivo'),
  justification: z.string().min(10, 'Describa el motivo (mínimo 10 caracteres)'),
});

type MonthlySettings = {
  quincena1_active: boolean;
  quincena2_active: boolean;
  quincena1_cutoff: number;
  quincena2_cutoff: number;
};

interface SupervisorReportFormProps {
  onSuccess: () => void;
}

export function SupervisorReportForm({ onSuccess }: SupervisorReportFormProps) {
  const { toast } = useToast();
  const [user, setUser] = useState<{ name: string; month: string } | null>(null);
  const [me, setMe] = useState<Employee | null>(null);
  const [colleagues, setColleagues] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<MonthlySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fileDataUri, setFileDataUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'pdf' | 'image' | null>(null);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      employeeName: '',
      absenceDate: '',
      reason: '',
      justification: '',
    },
  });

  const { control, watch, setValue, handleSubmit } = form;
  const watchedDate = watch('absenceDate');

  useEffect(() => {
    const stored = localStorage.getItem('overtimeUser');
    if (!stored) return;
    const parsed = JSON.parse(stored);
    setUser(parsed);

    const fetchData = async () => {
      try {
        const [empRes, setRes] = await Promise.all([
          fetch('/api/employees'),
          fetch(`/api/settings?month=${encodeURIComponent(parsed.month)}`),
        ]);

        const emps: Employee[] = await empRes.json();
        const activeEmps = Array.isArray(emps) ? emps.filter(e => e.status === 'active') : [];
        const meFound = activeEmps.find(e => e.name === parsed.name);

        if (meFound) {
          setMe(meFound);
          // Solo colaboradores de su misma sucursal (excluyéndose a sí mismo)
          setColleagues(
            activeEmps.filter(e => e.branch === meFound.branch && e.name !== meFound.name)
          );
        }

        if (setRes.ok) setSettings(await setRes.json());
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  /**
   * Días válidos: solo fechas pasadas o de hoy, dentro del mes contable,
   * y cuya quincena esté ACTIVA.
   */
  const availableDates = useMemo(() => {
    if (!user || !settings) return [];
    const monthIndex = months.indexOf(user.month);
    if (monthIndex === -1) return [];

    const now = startOfDay(new Date());
    const year = now.getFullYear();
    const daysInMonth = getDaysInMonth(new Date(year, monthIndex));
    const result: { value: string; label: string; quincena: 1 | 2 }[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, monthIndex, day);
      if (isAfter(startOfDay(date), now)) continue;

      let quincena: 1 | 2 | null = null;
      if (day <= settings.quincena1_cutoff) {
        quincena = settings.quincena1_active ? 1 : null;
      } else if (day <= settings.quincena2_cutoff) {
        quincena = settings.quincena2_active ? 2 : null;
      }
      if (!quincena) continue;

      result.push({
        value: format(date, 'yyyy-MM-dd'),
        label: format(date, "EEEE dd 'de' MMMM", { locale: es }),
        quincena,
      });
    }

    return result.sort((a, b) => b.value.localeCompare(a.value));
  }, [user, settings]);

  const selectedDateInfo = availableDates.find(d => d.value === watchedDate);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      toast({
        variant: 'destructive',
        title: 'Archivo no permitido',
        description: 'Solo se permiten archivos PDF o Imágenes (JPG, PNG).',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Archivo muy grande', description: 'El límite es de 5MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setFileDataUri(event.target?.result as string);
      setFileName(file.name);
      setFileType(isPdf ? 'pdf' : 'image');
    };
    reader.readAsDataURL(file);
  };

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    if (!user || !me) return;

    if (!selectedDateInfo) {
      toast({
        variant: 'destructive',
        title: 'Fecha no válida',
        description: 'La fecha seleccionada no pertenece a una quincena activa.',
      });
      return;
    }

    try {
      const response = await fetch('/api/supervisor-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          month: user.month,
          evidenceFileDataUri: fileDataUri,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Reporte Enviado',
          description: 'Administración de personal ha sido notificada.',
        });
        onSuccess();
      } else {
        const err = await response.json().catch(() => ({}));
        toast({
          variant: 'destructive',
          title: 'No se pudo enviar',
          description: err.error || 'Verifique los datos e intente nuevamente.',
        });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar el reporte.' });
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></div>;
  }

  if (!me?.isSupervisor) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="p-10 text-center space-y-2">
          <UserX className="h-10 w-10 mx-auto opacity-20" />
          <p className="font-bold">Acceso restringido</p>
          <p className="text-sm text-muted-foreground">
            Solo los jefes de agencia pueden emitir reportes de colaboradores.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-none sm:border-2 sm:border-primary/10 sm:shadow-lg">
      <CardHeader className="bg-primary/5 border-b px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-white p-2 rounded-lg">
            <UserX className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg sm:text-xl">Reporte de Colaborador</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Informa a administración que un colaborador de tu agencia no se presentó.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 px-4 sm:px-6">
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={control}
                name="employeeName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Colaborador</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecciona el colaborador" /></SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[300px]">
                        {colleagues.length > 0 ? colleagues.map(emp => (
                          <SelectItem key={emp.id} value={emp.name}>
                            <div className="flex items-center gap-2">
                              <span>{emp.name}</span>
                              <Badge variant="outline" className="text-[8px] h-4">{emp.position || 'Colaborador'}</Badge>
                            </div>
                          </SelectItem>
                        )) : (
                          <div className="p-3 text-xs text-muted-foreground text-center">
                            No hay colaboradores en tu sucursal.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-[10px]">
                      Solo se muestran colaboradores de tu sucursal: {me.branch}.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="absenceDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" /> Fecha de la Falta
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecciona el día" /></SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[300px]">
                        {availableDates.length > 0 ? availableDates.map(d => (
                          <SelectItem key={d.value} value={d.value}>
                            <div className="flex items-center gap-2">
                              <span className="capitalize">{d.label}</span>
                              <Badge variant="outline" className="text-[8px] h-4">Q{d.quincena}</Badge>
                            </div>
                          </SelectItem>
                        )) : (
                          <div className="p-3 text-xs text-muted-foreground text-center">
                            No hay días disponibles en quincenas activas.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-[10px]">
                      Solo días de quincenas activas del periodo {user?.month}.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {availableDates.length === 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  Las quincenas del periodo <strong>{user?.month}</strong> están cerradas. No es posible
                  registrar reportes de inasistencia en este momento.
                </p>
              </div>
            )}

            <FormField
              control={control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecciona el motivo" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="justification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detalle del Motivo</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe brevemente lo ocurrido..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormLabel>Evidencia (PDF o Imagen)</FormLabel>
              {!fileDataUri ? (
                <div className="relative border-2 border-dashed border-muted-foreground/20 rounded-xl p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer group">
                  <input type="file" accept=".pdf,image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} />
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2 group-hover:text-primary transition-colors" />
                  <p className="text-sm font-bold text-muted-foreground">Haz clic para subir archivo</p>
                  <p className="text-[10px] text-muted-foreground/60">PDF o Imágenes - Máx 5MB</p>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-primary/5 border-2 border-primary/20 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      {fileType === 'pdf' ? <FileSearch className="h-6 w-6 text-primary" /> : <ImageIcon className="h-6 w-6 text-primary" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold truncate max-w-[200px]">{fileName}</span>
                      <span className="text-[10px] text-green-600 font-bold flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> LISTO</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => { setFileDataUri(null); setFileName(null); setFileType(null); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3 shadow-sm">
              <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-900 leading-relaxed italic">
                Este reporte informa a Administración de Personal sobre la inasistencia de un colaborador
                de tu agencia. La validación y el dictamen final corresponden al departamento de RRHH.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full h-12 gap-2 text-lg shadow-xl"
              disabled={form.formState.isSubmitting || availableDates.length === 0}
            >
              {form.formState.isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
              Enviar Reporte
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
