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
  parseISO
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

const hours = Array.from({ length: 12 }, (_, i) =>
  (i + 1).toString().padStart(2, '0')
);
const minutes = ['00', '15', '30', '45'];
const periods = ['AM', 'PM'];

const FormSchema = z.object({
  date: z.date({
    required_error: 'La fecha es requerida.',
  }),
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

    return [...spilloverDays, ...currMonthDays]
      .filter(day => startOfDay(day) <= now) 
      .filter(day => {
        const dayMonthIndex = day.getMonth();
        const dom = day.getDate();

        if (dayMonthIndex !== monthIndex) {
            return settings.quincena1_active;
        }
        
        if (dom <= settings.quincena1_cutoff) return settings.quincena1_active;
        if (dom <= settings.quincena2_cutoff) return settings.quincena2_active;
        
        if (dom > settings.quincena2_cutoff) {
            return true;
        }

        return false;
      })
      .sort((a, b) => b.getTime() - a.getTime());
  }, [user, settings, prevMonthSettings]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      startHour: '05', startMinute: '00', startPeriod: 'PM',
      endHour: '06', endMinute: '00', endPeriod: 'PM',
      activity: '', coworkers: [],
    },
  });

  const { control, watch, setValue, getValues } = form;
  const watchedTime = watch(['date', 'startHour', 'startMinute', 'startPeriod', 'endHour', 'endMinute', 'endPeriod']);

  const calculatedHours = React.useMemo(() => {
    const [date, sh, sm, sp, eh, em, ep] = watchedTime;
    if (!date || !sh || !sm || !sp || !eh || !em || !ep) return { totalHours: 0, dayHours: 0, nightHours: 0 };
    return calculateOvertime(date, `${sh}:${sm} ${sp}`, `${eh}:${em} ${ep}`);
  }, [watchedTime]);

  useEffect(() => {
    if (availableDates.length > 0 && !getValues('date')) {
      const today = availableDates.find(d => isToday(d));
      setValue('date', today || availableDates[0]);
    }
  }, [availableDates, setValue, getValues]);

  function onSubmit(data: z.infer<typeof FormSchema>) {
    if (!user || !settings) return;
    const st = `${data.startHour}:${data.startMinute} ${data.startPeriod}`;
    const et = `${data.endHour}:${data.endMinute} ${data.endPeriod}`;

    if (existingRecords.some(rec => isTimeOverlapping(data.date, st, et, rec.date, rec.startTime, rec.endTime))) {
      toast({ variant: 'destructive', title: 'Horario en Conflicto', description: 'Ya tienes horas registradas en este lapso.' });
      return;
    }

    const selectedDateStr = format(data.date, 'yyyy-MM-dd');
    const permitConflict = myPermits.find(p => p.startDate === selectedDateStr || p.endDate === selectedDateStr);
    
    if (permitConflict) {
      toast({
        variant: 'destructive',
        title: 'Día no laborable',
        description: `No puedes cobrar horas extra en un día con ${permitConflict.action === 'INASISTENCIA' ? 'Inasistencia' : 'Permiso'} registrado.`,
      });
      return;
    }

    if (calculatedHours.totalHours <= 0) {
      toast({ variant: 'destructive', title: 'Hora Inválida', description: 'La hora de fin debe ser posterior a la de inicio.' });
      return;
    }

    const currentMonthIdx = months.indexOf(user.month);
    let quincena;
    if (data.date.getMonth() === currentMonthIdx && data.date.getDate() > settings.quincena2_cutoff) {
      quincena = 1;
    } else if (data.date.getMonth() !== currentMonthIdx || data.date.getDate() <= settings.quincena1_cutoff) {
      quincena = 1;
    } else {
      quincena = 2;
    }

    onRecordAdded({
      id: crypto.randomUUID(), 
      date: data.date, 
      startTime: st, 
      endTime: et,
      activity: data.activity, 
      coworkers: data.coworkers.join(', '),
      quincena: quincena as 1 | 2,
      totalHours: calculatedHours.totalHours, 
      dayHours: calculatedHours.dayHours, 
      nightHours: calculatedHours.nightHours,
      type: 'overtime', 
      status: 'pending', 
      adminNotes: '',
    });
    closeSheet();
  }

  const getSafeISOString = (date: any) => {
    if (date instanceof Date && !isNaN(date.getTime())) {
      return date.toISOString();
    }
    return "";
  };

  if (!settings) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <ScrollArea className="h-full">
      <div className="pr-6 py-4">
        <div className="mb-6 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-primary" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-primary/70 tracking-wider">Hoy</span>
            <span className="text-sm font-mono font-bold text-primary">{currentTime ? format(currentTime, "dd/MM/yyyy HH:mm") : '--'}</span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={control} name="date" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-bold">Fecha de la Labor</FormLabel>
                <Select 
                  onValueChange={(v) => field.onChange(new Date(v))} 
                  value={getSafeISOString(field.value)}
                >
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Selecciona la fecha" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableDates.length > 0 ? availableDates.map(d => (
                      <SelectItem key={d.toISOString()} value={d.toISOString()}>
                        {format(d, "eeee, dd 'de' MMMM", { locale: es })}
                      </SelectItem>
                    )) : (
                        <SelectItem value="none" disabled>No hay fechas habilitadas</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormDescription className="text-[10px]">
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

            <Button type="submit" className="w-full h-12 text-lg shadow-xl mt-4" disabled={availableDates.length === 0}>
                {availableDates.length === 0 ? 'Sin fechas disponibles' : 'Guardar Registro'}
            </Button>
          </form>
        </Form>
      </div>
    </ScrollArea>
  );
}
