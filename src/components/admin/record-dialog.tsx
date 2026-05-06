
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
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
import { calculateOvertime } from '@/lib/utils';
import { Loader2, CalendarIcon } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import React, { useEffect, useState } from 'react';
import type { OvertimeRecord, Employee } from '@/lib/types';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';

const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const minutes = ['00', '15', '30', '45'];
const periods = ['AM', 'PM'];

const FormSchema = z.object({
  employeeName: z.string().min(1, 'El empleado es requerido.'),
  dateStr: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Formato inválido (DD/MM/YYYY)'),
  startTime: z.string().min(1, 'La hora de inicio es requerida.'),
  endTime: z.string().min(1, 'La hora de fin es requerida.'),
  activity: z.string().min(10, 'La actividad debe tener al menos 10 caracteres.'),
  coworkers: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']),
  type: z.enum(['overtime', 'additional_day']),
  adminNotes: z.string().optional(),
});

type RecordDialogProps = {
  record: Partial<OvertimeRecord> | null;
  employees: Employee[];
  month: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (record: OvertimeRecord) => void;
};

const TimePicker = ({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) => {
    const [hour, minute, period] = value ? value.split(/[:\s]/) : ['05', '00', 'PM'];

    const handleTimeChange = (part: 'h' | 'm' | 'p', val: string) => {
        let newHour = hour, newMinute = minute, newPeriod = period;
        if (part === 'h') newHour = val;
        if (part === 'm') newMinute = val;
        if (part === 'p') newPeriod = val;
        onChange(`${newHour}:${newMinute} ${newPeriod}`);
    };

    return (
        <div className="grid grid-cols-3 gap-2">
            <Select value={hour} onValueChange={(v) => handleTimeChange('h', v)} disabled={disabled}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{hours.map(h => <SelectItem key={`h-${h}`} value={h}>{h}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={minute} onValueChange={(v) => handleTimeChange('m', v)} disabled={disabled}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{minutes.map(m => <SelectItem key={`m-${m}`} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={period} onValueChange={(v) => handleTimeChange('p', v)} disabled={disabled}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{periods.map(p => <SelectItem key={`p-${p}`} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
        </div>
    );
};


export function RecordDialog({ record, employees, month, isOpen, onOpenChange, onSave }: RecordDialogProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const isEditMode = !!record?.id;

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
        employeeName: '',
        dateStr: format(new Date(), 'dd/MM/yyyy'),
        startTime: '05:00 PM',
        endTime: '06:00 PM',
        activity: '',
        coworkers: '',
        status: 'pending',
        type: 'overtime',
        adminNotes: '',
    }
  });

  const { control, watch, handleSubmit, reset, setValue } = form;

  useEffect(() => {
    if (isOpen && record) {
      reset({
        employeeName: (record as any).employeeName || '',
        dateStr: record.date ? format(new Date(record.date), 'dd/MM/yyyy') : format(new Date(), 'dd/MM/yyyy'),
        startTime: record.startTime || '05:00 PM',
        endTime: record.endTime || '06:00 PM',
        activity: record.activity || '',
        coworkers: record.coworkers || '',
        status: record.status || 'pending',
        type: record.type || 'overtime',
        adminNotes: record.adminNotes || '',
      });
    } else if (isOpen && !isEditMode) {
      reset({
        employeeName: '',
        dateStr: format(new Date(), 'dd/MM/yyyy'),
        startTime: '05:00 PM',
        endTime: '06:00 PM',
        activity: '',
        coworkers: '',
        status: 'pending',
        type: 'overtime',
        adminNotes: '',
      });
    }
  }, [record, isOpen, reset, isEditMode]);
  
  const watchedFields = watch(['dateStr', 'startTime', 'endTime', 'type']);

  const calculatedHours = React.useMemo(() => {
    const [dateStr, startTime, endTime, type] = watchedFields;
    if (!dateStr || !startTime || !endTime) return { totalHours: 0, dayHours: 0, nightHours: 0 };
    
    const parsedDate = parse(dateStr, 'dd/MM/yyyy', new Date());
    if (!isValid(parsedDate)) return { totalHours: 0, dayHours: 0, nightHours: 0 };
    
    const base = calculateOvertime(parsedDate, startTime, endTime);
    
    if (type === 'additional_day') {
        return { ...base, dayHours: 0, nightHours: 0 };
    }
    
    return base;
  }, [watchedFields]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.slice(0, 8);
    
    let formatted = val;
    if (val.length > 2) formatted = val.slice(0, 2) + '/' + val.slice(2);
    if (val.length > 4) formatted = val.slice(0, 2) + '/' + val.slice(2, 4) + '/' + val.slice(4);
    
    setValue('dateStr', formatted);
  };

  const processSubmit = async (data: z.infer<typeof FormSchema>) => {
    setIsSaving(true);
    
    const parsedDate = parse(data.dateStr, 'dd/MM/yyyy', new Date());
    if (!isValid(parsedDate)) {
        toast({ variant: 'destructive', title: 'Fecha Inválida', description: 'Por favor ingresa una fecha válida en formato DD/MM/YYYY' });
        setIsSaving(false);
        return;
    }

    if (calculatedHours.totalHours <= 0) {
      toast({ variant: 'destructive', title: 'Hora Inválida', description: 'La hora de fin debe ser posterior a la de inicio.' });
      setIsSaving(false);
      return;
    }
    
    const dayOfMonth = parsedDate.getDate();
    const quincena = dayOfMonth <= 15 ? 1 : 2;

    const recordToSave: OvertimeRecord = {
      id: record?.id || crypto.randomUUID(),
      date: parsedDate,
      startTime: data.startTime,
      endTime: data.endTime,
      activity: data.activity,
      coworkers: data.coworkers || '',
      quincena: quincena as 1 | 2,
      totalHours: calculatedHours.totalHours,
      dayHours: calculatedHours.dayHours,
      nightHours: calculatedHours.nightHours,
      status: data.status,
      type: data.type,
      adminNotes: data.adminNotes || '',
    };

    try {
      const response = await fetch('/api/admin/records', {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            employeeName: data.employeeName,
            month: month,
            record: recordToSave
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${isEditMode ? 'update' : 'create'} record.`);
      }

      const savedRecord = await response.json();
      onSave({ ...savedRecord, date: new Date(savedRecord.date), employeeName: data.employeeName });
      toast({ title: 'Éxito', description: `Registro ${isEditMode ? 'actualizado' : 'creado'} con éxito.` });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Editar Registro' : 'Agregar Nuevo Registro'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Modifica los detalles del registro.' : 'Crea un nuevo registro para un empleado. Se permite el traslape de horarios para ajustes administrativos.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit(processSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
             <FormField
                control={control}
                name="employeeName"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Empleado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isEditMode || isSaving}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un empleado" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {employees.map((emp) => (
                                <SelectItem key={emp.id} value={emp.name}>
                                    [{emp.id}] - {emp.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            
            <FormField
              control={control}
              name="dateStr"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha (DD/MM/YYYY)</FormLabel>
                  <FormControl>
                    <div className="relative">
                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            {...field} 
                            placeholder="DD/MM/YYYY" 
                            onChange={handleDateChange}
                            className="pl-10 font-mono"
                            disabled={isSaving}
                        />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
                control={control}
                name="startTime"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Hora Inicio</FormLabel>
                    <FormControl>
                        <TimePicker value={field.value} onChange={field.onChange} disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="endTime"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Hora Fin</FormLabel>
                    <FormControl>
                        <TimePicker value={field.value} onChange={field.onChange} disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
           
            <FormField control={control} name="activity" render={({ field }) => (
                <FormItem>
                    <FormLabel>Actividad</FormLabel>
                    <FormControl>
                        <Textarea placeholder="Describe la actividad..." {...field} disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={control} name="coworkers" render={({ field }) => (
                <FormItem>
                    <FormLabel>Compañeros (opcional)</FormLabel>
                    <FormControl>
                        <Input placeholder="Nombres separados por coma" {...field} disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
                <FormField control={control} name="type" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}>
                            <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="overtime">Horas Extra</SelectItem>
                                <SelectItem value="additional_day">Día Adicional</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={control} name="status" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}>
                            <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="pending">Pendiente</SelectItem>
                                <SelectItem value="approved">Aprobado</SelectItem>
                                <SelectItem value="rejected">Rechazado</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}/>
            </div>
             <FormField control={control} name="adminNotes" render={({ field }) => (
                <FormItem>
                    <FormLabel>Notas de Admin (opcional)</FormLabel>
                    <FormControl>
                        <Textarea placeholder="Notas internas sobre la modificación..." {...field} disabled={isSaving} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )} />

             <div className="p-4 bg-muted/20 border rounded-lg">
                <div className="flex justify-between text-xs mb-1"><span>Total Horas:</span><span className="font-bold">{calculatedHours.totalHours.toFixed(2)}</span></div>
                <div className="flex justify-between text-xs text-muted-foreground italic">
                    <span>Desglose:</span>
                    <span>{calculatedHours.dayHours.toFixed(2)}D / {calculatedHours.nightHours.toFixed(2)}N</span>
                </div>
             </div>

             <DialogFooter className="sticky bottom-0 bg-background pt-4">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
                <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
