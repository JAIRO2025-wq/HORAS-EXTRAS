'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { cn, calculateOvertime, isTimeOverlapping } from '@/lib/utils';
import {
  Check,
  Sun,
  Moon,
  Clock,
  X,
  Loader2,
  CalendarDays,
  ShieldAlert,
  AlertTriangle,
  Info,
  CalendarPlus,
  Repeat,
  PartyPopper,
} from 'lucide-react';
import {
  format,
  eachDayOfInterval,
  endOfMonth,
  startOfMonth,
  isToday,
  endOfDay,
  set,
  subMonths,
  getDaysInMonth,
  startOfDay,
  isValid,
  parseISO,
  isAfter,
  isSameDay,
  isBefore
} from 'date-fns';
import { es } from 'date-fns/locale';
import React, { useEffect, useState } from 'react';
import type { OvertimeRecord, Employee, PermitRequest } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { months } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '../ui/input';

const hours = Array.from({ length: 12 }, (_, i) =>
  (i + 1).toString().padStart(2, '0')
);
const minutes = ['00', '15', '30', '45'];
const periods = ['AM', 'PM'];

const FormSchema = z.object({
  date: z.date({
    required_error: 'La fecha es requerida.',
  }),
  type: z.enum(['overtime', 'additional_day']).default('overtime'),
  startHour: z.string(),
  startMinute: z.string(),
  startPeriod: z.string(),
  endHour: z.string(),
  endMinute: z.string(),
  endPeriod: z.string(),
  activity: z.string().min(10, {
    message: 'La actividad debe tener al menos 10 caracteres.',
  }),
  coworkers: z.array(z.string()).default([]),
});

type Settings = {
  quincena1_active: boolean;
  quincena2_active: boolean;
  quincena1_cutoff: number;
  quincena2_cutoff: number;
};

/**
 * Tipos de registro disponibles en el formulario.
 * - overtime: Horas Extra → se cobran por hora (flujo original con horario).
 * - additional_day: Cubrir Turno / Asueto / Día Adicional → jornada completa (8h), sin horario.
 */
const RECORD_TYPES = [
  {
    value: 'overtime' as const,
    label: 'Horas Extras',
    hint: 'Labor adicional fuera de su jornada',
    icon: Clock,
  },
  {
    value: 'additional_day' as const,
    label: 'Cubrir Turno',
    hint: 'Reemplazo de un compañero ausente',
    icon: Repeat,
  },
  {
    value: 'additional_day' as const,
    label: 'Asueto',
    hint: 'Labor en día de asueto o feriado',
    icon: PartyPopper,
  },
  {
    value: 'additional_day' as const,
    label: 'Día Adicional',
    hint: 'Jornada completa adicional (8h)',
    icon: CalendarPlus,
  },
];

const TYPE_INFO_KEY = 'overtime_record_types_info_v1';

type AddHoursFormProps = {
  onRecordAdded: (record: OvertimeRecord) => void;
  closeSheet: () => void;
  existingRecords: OvertimeRecord[];
};

export function AddHoursForm({ onRecordAdded, closeSheet, existingRecords }: AddHoursFormProps) {
  const { toast } = useToast();
  const [user, setUser] = useState<{ name: string; month: string } | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [prevMonthSettings, setPrevMonthSettings] = useState<Settings | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [myPermits, setMyPermits] = useState<PermitRequest[]>([]);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTypeInfo, setShowTypeInfo] = useState(false);
  const [selectedTypeLabel, setSelectedTypeLabel] = useState('Horas Extras');

  // Cartel informativo de tipos de registro: se muestra UNA sola vez por usuario.
  useEffect(() => {
    const storedUser = localStorage.getItem('overtimeUser');
    const userName = storedUser ? JSON.parse(storedUser)?.name || 'anon' : 'anon';
    const seenKey = `${TYPE_INFO_KEY}_${userName}`;
    if (!localStorage.getItem(seenKey)) {
      const timer = setTimeout(() => setShowTypeInfo(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismissTypeInfo = () => {
    const storedUser = localStorage.getItem('overtimeUser');
    const userName = storedUser ? JSON.parse(storedUser)?.name || 'anon' : 'anon';
    localStorage.setItem(`${TYPE_INFO_KEY}_${userName}`, 'true');
    setShowTypeInfo(false);
  };

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('overtimeUser');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);

      const fetchData = async () => {
        try {
          const [empRes, perRes] = await Promise.all([
            fetch('/api/employees'),
            fetch(`/api/permits?user=${encodeURIComponent(parsedUser.name)}`)
          ]);
          
          if (empRes.ok) {
            const emps = await empRes.json();
            setEmployees(Array.isArray(emps) ? emps.filter((e: Employee) => e.name !== parsedUser.name && e.status === 'active') : []);
          }
          
          if (perRes.ok) {
            const pers = await perRes.json();
            setMyPermits(Array.isArray(pers) ? pers.filter(p => p.employeeName === parsedUser.name && p.status !== 'rejected') : []);
          }
        } catch (e) {
          console.error("Error loading form context:", e);
        }
      };
      fetchData();
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const loadSettings = async () => {
        try {
            const res = await fetch(`/api/settings?month=${encodeURIComponent(user.month)}`);
            if (res.ok) setSettings(await res.json());

            const monthIndex = months.indexOf(user.month);
            const prevMonthName = months[(monthIndex - 1 + 12) % 12];
            const prevRes = await fetch(`/api/settings?month=${encodeURIComponent(prevMonthName)}`);
            if (prevRes.ok) setPrevMonthSettings(await prevRes.json());
        } catch (e) {
            console.error("Error loading settings:", e);
        }
    };
    
    loadSettings();
  }, [user]);

  const availableDates = React.useMemo(() => {
    if (!user || !settings) return [];
    const monthIndex = months.indexOf(user.month);
    if (monthIndex === -1) return [];

    const now = startOfDay(new Date());
    const currentYear = now.getFullYear();
    
    // VIGENCIA: 15 de JUNIO de 2026 (Mes 5 en JS es Junio)
    const POLICY_START_DATE = new Date(2026, 5, 15); 
    const isStrictPolicyActive = isAfter(now, POLICY_START_DATE) || isSameDay(now, POLICY_START_DATE);
    
    const selectedMonthDate = new Date(currentYear, monthIndex, 1);
    const currMonthDays = eachDayOfInterval({ 
      start: startOfMonth(selectedMonthDate), 
      end: endOfMonth(selectedMonthDate) 
    });

    let spilloverDays: Date[] = [];
    if (prevMonthSettings) {
      const lastMonthDate = subMonths(selectedMonthDate, 1);
      const daysInPrevMonth = getDaysInMonth(lastMonthDate);
      
      if (prevMonthSettings.quincena2_cutoff < daysInPrevMonth) {
        const startDay = prevMonthSettings.quincena2_cutoff + 1;
        const spillStart = set(lastMonthDate, { date: startDay, hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });
        const spillEnd = endOfMonth(lastMonthDate);
        
        if (isValid(spillStart) && isValid(spillEnd) && spillStart <= spillEnd) {
          spilloverDays = eachDayOfInterval({ start: spillStart, end: spillEnd });
        }
      }
    }

    const allPotentialDays = [...spilloverDays, ...currMonthDays];

    return allPotentialDays
      .filter(day => {
        const d = startOfDay(day);
        
        if (isAfter(d, now)) return false;

        // POLÍTICA ESTRICTA: SI ES 15 DE JUNIO O DESPUÉS, SÓLO PERMITIR "HOY"
        if (isStrictPolicyActive) {
            return isToday(d);
        }
        
        return true;
      })
      .filter(day => {
        const dayMonthIndex = day.getMonth();
        const dom = day.getDate();

        if (dayMonthIndex !== monthIndex) {
            return settings.quincena1_active;
        }
        
        if (dom <= settings.quincena1_cutoff) return settings.quincena1_active;
        if (dom <= settings.quincena2_cutoff) return settings.quincena2_active;
        
        return false;
      })
      .filter((date, index, self) => 
        index === self.findIndex((d) => isSameDay(d, date))
      )
      .sort((a, b) => b.getTime() - a.getTime());
  }, [user, settings, prevMonthSettings]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      type: 'overtime',
      startHour: '00', startMinute: '00', startPeriod: 'AM',
      endHour: '00', endMinute: '00', endPeriod: 'AM',
      activity: '', coworkers: [],
    },
  });

  const { control, watch, setValue, getValues } = form;
  const watchedTime = watch(['date', 'startHour', 'startMinute', 'startPeriod', 'endHour', 'endMinute', 'endPeriod']);
  const watchedType = watch('type');
  const isAdditionalDay = watchedType === 'additional_day';
  const calculatedHours = React.useMemo(() => {
    const [date, sh, sm, sp, eh, em, ep] = watchedTime;
    if (!date || !sh || !sm || !sp || !eh || !em || !ep) return { totalHours: 0, dayHours: 0, nightHours: 0 };
    return calculateOvertime(date, `${sh}:${sm} ${sp}`, `${eh}:${em} ${ep}`);
  }, [watchedTime]);

  useEffect(() => {
    if (availableDates.length > 0 && !getValues('date')) {
      setValue('date', availableDates[0]);
    }
  }, [availableDates, setValue, getValues]);

  // Al elegir Cubrir Turno / Asueto / Día Adicional, precargamos la jornada
  // ordinaria (08:00 AM - 05:00 PM). En Horas Extras el horario queda en 00:00.
  useEffect(() => {
    if (isAdditionalDay) {
      setValue('startHour', '08');
      setValue('startMinute', '00');
      setValue('startPeriod', 'AM');
      setValue('endHour', '05');
      setValue('endMinute', '00');
      setValue('endPeriod', 'PM');
    } else {
      setValue('startHour', '00');
      setValue('startMinute', '00');
      setValue('startPeriod', 'AM');
      setValue('endHour', '00');
      setValue('endMinute', '00');
      setValue('endPeriod', 'AM');
    }
  }, [isAdditionalDay, setValue]);

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    if (!user || !settings) return;
    const st = `${data.startHour}:${data.startMinute} ${data.startPeriod}`;
    const et = `${data.endHour}:${data.endMinute} ${data.endPeriod}`;
    const isAdditional = data.type === 'additional_day';

    // Cubrir Turno / Asueto / Día Adicional: solo un registro de este tipo por día.
    if (isAdditional) {
      const alreadyRegistered = existingRecords.some(rec =>
        rec.type === 'additional_day' &&
        rec.status !== 'rejected' &&
        isSameDay(new Date(rec.date), data.date)
      );
      if (alreadyRegistered) {
        toast({
          variant: 'destructive',
          title: 'Registro Duplicado',
          description: `Ya existe un registro de ${selectedTypeLabel} para el día ${format(data.date, "dd 'de' MMMM", { locale: es })}.`,
        });
        return;
      }
    }

    // El día adicional se paga como jornada completa: no valida traslape de horas.
    if (!isAdditional && existingRecords.some(rec => isTimeOverlapping(data.date, st, et, rec.date, rec.startTime, rec.endTime))) {
      toast({ variant: 'destructive', title: 'Horario en Conflicto', description: 'Ya tienes horas registradas en este lapso.' });
      return;
    }

    const selectedDateStr = format(data.date, 'yyyy-MM-dd');
    const permitConflict = myPermits.find(p => p.startDate <= selectedDateStr && p.endDate >= selectedDateStr);
    
    if (permitConflict) {
      toast({
        variant: 'destructive',
        title: 'Día no laborable',
        description: `No puedes cobrar horas extra en un día con ${permitConflict.action === 'INASISTENCIA' ? 'Inasistencia' : 'Permiso'} registrado.`,
      });
      return;
    }

    if (!isAdditional && calculatedHours.totalHours <= 0) {
      toast({ variant: 'destructive', title: 'Hora Inválida', description: 'La hora de fin debe ser posterior a la de inicio.' });
      return;
    }

    const currentMonthIdx = months.indexOf(user.month);
    let quincena: 1 | 2 = 1;

    if (data.date.getMonth() === currentMonthIdx) {
        if (data.date.getDate() > settings.quincena1_cutoff) {
            quincena = 2;
        }
    }

    setIsSubmitting(true);
    try {
      await onRecordAdded({
        id: crypto.randomUUID(), 
        date: data.date, 
        startTime: st, 
        endTime: et,
        activity: data.activity, 
        coworkers: data.coworkers.join(', '),
        quincena: quincena,
        totalHours: isAdditional ? 8 : calculatedHours.totalHours,
        dayHours: isAdditional ? 0 : calculatedHours.dayHours,
        nightHours: isAdditional ? 0 : calculatedHours.nightHours,
        type: data.type,
        status: 'pending',
        adminNotes: '',
      });
      closeSheet();
    } finally {
      setIsSubmitting(false);
    }
  }

  const getSafeISOString = (date: any) => {
    if (date instanceof Date && !isNaN(date.getTime())) {
      return date.toISOString();
    }
    return "";
  };

  if (!settings) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (availableDates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-red-100 p-6 rounded-full mb-6 border-4 border-red-50">
            <ShieldAlert className="h-16 w-16 text-red-600" />
        </div>
        <h3 className="text-xl font-black text-red-950 uppercase tracking-tighter mb-2">Registro Bloqueado</h3>
        <p className="text-sm text-red-800 leading-relaxed mb-8">
            Usted está intentando realizar un registro <strong>fuera del plazo establecido</strong> o la quincena se encuentra cerrada.
        </p>
        
        <div className="w-full bg-white border-2 border-red-200 rounded-2xl p-6 shadow-xl shadow-red-100/50 mb-8 space-y-4">
            <div className="flex items-center gap-2 justify-center text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Protocolo Administrativo</span>
            </div>
            <p className="text-xs text-zinc-600">
                A partir del 15 de junio de 2026, el sistema solo permite registros en tiempo real. Para habilitar un registro extemporáneo, su jefatura inmediata debe emitir una justificación técnica.
            </p>
            <div className="pt-4 border-t border-red-50">
                <p className="text-xs font-bold text-red-900 uppercase">Por favor contacte a:</p>
                <p className="text-sm font-black text-red-700">RECURSOS HUMANOS</p>
            </div>
        </div>

        <Button onClick={closeSheet} variant="outline" className="w-full border-red-200 text-red-700 hover:bg-red-50 h-12 font-bold">
            Entendido, Cerrar Panel
        </Button>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="pr-6 py-4">
        <Alert className="mb-6 bg-amber-50 border-amber-200">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-[11px] font-black uppercase tracking-wider text-amber-800">Control de Puntualidad</AlertTitle>
          <AlertDescription className="text-[10px] text-amber-700 leading-tight">
            Verifique que la fecha seleccionada sea la correcta. A partir del 15 de junio, solo se permiten registros del día actual.
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={control} name="type" render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="text-sm font-bold">Tipo de Registro</FormLabel>
                  <button
                    type="button"
                    onClick={() => setShowTypeInfo(true)}
                    className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <Info className="h-3 w-3" /> ¿Cuál es la diferencia?
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {RECORD_TYPES.map((t) => {
                    const Icon = t.icon;
                    const active = field.value === t.value && selectedTypeLabel === t.label;
                    return (
                      <button
                        key={t.label}
                        type="button"
                        onClick={() => {
                          field.onChange(t.value);
                          setSelectedTypeLabel(t.label);
                        }}
                        className={cn(
                          'flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all',
                          active
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-muted bg-muted/30 hover:border-primary/40'
                        )}
                      >
                        <Icon className={cn('h-5 w-5', active ? 'text-primary' : 'text-muted-foreground')} />
                        <span className={cn('text-[11px] font-black uppercase leading-tight', active ? 'text-primary' : 'text-muted-foreground')}>
                          {t.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <FormDescription className="text-[10px] font-medium">
                  {isAdditionalDay
                    ? 'Se registrará como jornada completa (8 horas) y no requiere horario.'
                    : 'Se registrará por horas según el horario indicado abajo.'}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={control} name="date" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-bold">Fecha de la Labor</FormLabel>
                <Select 
                  onValueChange={(v) => field.onChange(new Date(v))} 
                  value={getSafeISOString(field.value)}
                >
                  <FormControl>
                    <SelectTrigger className="h-11 bg-muted/50 font-bold border-primary/20">
                      <SelectValue placeholder="Selecciona una fecha" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableDates.map(d => (
                      <SelectItem key={d.toISOString()} value={d.toISOString()}>
                        {isToday(d) ? 'HOY: ' : ''}{format(d, "eeee, dd 'de' MMMM", { locale: es })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription className="text-[10px] font-medium text-primary">
                    Si un día no aparece, es porque la quincena está cerrada o ya pasó el límite de registro.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <FormLabel className="text-sm font-bold text-primary">Hora de Inicio</FormLabel>
                <div className="grid grid-cols-3 gap-1.5">
                  <FormField control={control} name="startHour" render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="h-11 px-1.5 focus:ring-primary"><SelectValue /></SelectTrigger>
                      <SelectContent>{hours.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
                  <FormField control={control} name="startMinute" render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="h-11 px-1.5 focus:ring-primary"><SelectValue /></SelectTrigger>
                      <SelectContent>{minutes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
                  <FormField control={control} name="startPeriod" render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="h-11 px-1.5 focus:ring-primary"><SelectValue /></SelectTrigger>
                      <SelectContent>{periods.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
                </div>
              </div>
              <div className="space-y-3">
                <FormLabel className="text-sm font-bold text-primary">Hora de Finalización</FormLabel>
                <div className="grid grid-cols-3 gap-1.5">
                  <FormField control={control} name="endHour" render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="h-11 px-1.5 focus:ring-primary"><SelectValue /></SelectTrigger>
                      <SelectContent>{hours.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
                  <FormField control={control} name="endMinute" render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="h-11 px-1.5 focus:ring-primary"><SelectValue /></SelectTrigger>
                      <SelectContent>{minutes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
                  <FormField control={control} name="endPeriod" render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="h-11 px-1.5 focus:ring-primary"><SelectValue /></SelectTrigger>
                      <SelectContent>{periods.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  )} />
                </div>
              </div>
            </div>

            {isAdditionalDay ? (
              <Card className="border-dashed bg-emerald-50/60 border-emerald-300">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-full">
                      <CalendarPlus className="h-5 w-5 text-emerald-700" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-emerald-900 uppercase tracking-tight">{selectedTypeLabel}</p>
                      <p className="text-[11px] text-emerald-700 font-medium">
                        Se registrará como jornada completa equivalente a <strong>8.00 hrs</strong>.
                        Si realizó horas extra adicionales ese día, regístrelas aparte como <strong>Horas Extras</strong>.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
            <Card className="border-dashed bg-muted/50 border-primary/20">
              <CardContent className="p-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground flex items-center"><Sun className="w-4 h-4 mr-1.5" />Diurnas</span>
                  <span className="font-mono font-bold">{(calculatedHours.dayHours || 0).toFixed(2)} hrs</span>
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-muted-foreground flex items-center"><Moon className="w-4 h-4 mr-1.5" />Nocturnas</span>
                  <span className="font-mono font-bold">{(calculatedHours.nightHours || 0).toFixed(2)} hrs</span>
                </div>
                <hr className="my-2 border-primary/10" />
                <div className="flex justify-between items-center font-bold">
                  <span className="flex items-center"><Clock className="w-4 h-4 mr-1.5 text-primary" />Total</span>
                  <span className="font-mono text-primary text-xl">{(calculatedHours.totalHours || 0).toFixed(2)} hrs</span>
                </div>
              </CardContent>
            </Card>
            )}

            <FormField control={control} name="activity" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-bold">Actividad Realizada</FormLabel>
                <FormControl><Textarea placeholder="Describe brevemente la actividad..." className="min-h-[100px] resize-none" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={control} name="coworkers" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-bold">Compañeros presentes</FormLabel>
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-start h-auto min-h-11 text-left px-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {field.value?.length ? field.value.map(c => <Badge key={c} variant="secondary" className="h-5 text-[10px] font-bold">{c}</Badge>) : "Seleccionar compañeros..."}
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 border rounded-md p-2 max-h-48 overflow-y-auto shadow-inner bg-background">
                    {employees.map(e => (
                      <div key={e.id} onClick={() => {
                        const cur = field.value || [];
                        field.onChange(cur.includes(e.name) ? cur.filter(v => v !== e.name) : [...cur, e.name]);
                      }} className={cn("px-3 py-2 text-sm cursor-pointer rounded-md mb-1 hover:bg-primary/5 transition-colors", (field.value || []).includes(e.name) && "bg-primary text-primary-foreground hover:bg-primary/90")}>
                        {e.name}
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </FormItem>
            )} />

            <Button type="submit" className="w-full h-12 text-lg shadow-xl mt-4" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                {isSubmitting ? 'Guardando...' : 'Guardar Registro'}
            </Button>
          </form>
        </Form>
      </div>

      {/* Cartel informativo: se muestra una sola vez por usuario */}
      <Dialog open={showTypeInfo} onOpenChange={(open) => { if (!open) dismissTypeInfo(); }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-0 space-y-0">
            <div className="bg-primary p-5 text-primary-foreground flex items-center gap-3">
              <div className="bg-white/20 p-2.5 rounded-full">
                <Info className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black tracking-tighter uppercase leading-none text-primary-foreground">
                  Tipos de Registro
                </DialogTitle>
                <DialogDescription className="text-[10px] font-bold opacity-80 mt-1 uppercase tracking-widest text-primary-foreground/80">
                  Guía rápida para clasificar correctamente su jornada
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-3 bg-white">
            <div className="flex items-start gap-3 p-3 rounded-lg border border-indigo-200 bg-indigo-50">
              <Clock className="h-5 w-5 text-indigo-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black uppercase text-indigo-900">Horas Extras</p>
                <p className="text-[11px] text-indigo-800 leading-snug mt-0.5">
                  Cuando labora tiempo adicional fuera de su jornada habitual.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border border-sky-200 bg-sky-50">
              <Repeat className="h-5 w-5 text-sky-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black uppercase text-sky-900">Cubrir Turno</p>
                <p className="text-[11px] text-sky-800 leading-snug mt-0.5">
                  Cuando usted cubre el turno de un compañero ausente, dentro de su jornada habitual.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
              <PartyPopper className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black uppercase text-amber-900">Asueto</p>
                <p className="text-[11px] text-amber-800 leading-snug mt-0.5">
                  Cuando labora en un día de asueto, feriado o descanso oficial.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
              <CalendarPlus className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black uppercase text-emerald-900">Día Adicional</p>
                <p className="text-[11px] text-emerald-800 leading-snug mt-0.5">
                  Cuando trabaja una jornada completa que no corresponde a horas extra.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-800 font-semibold leading-snug">
                No registre un día adicional como horas extra: el cálculo de planilla es distinto y el registro será rechazado.
              </p>
            </div>
          </div>

          <DialogFooter className="p-5 bg-zinc-50 border-t">
            <Button onClick={dismissTypeInfo} className="w-full h-11 font-bold gap-2">
              <Check className="h-4 w-4" /> Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
