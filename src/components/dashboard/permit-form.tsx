
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, isAfter, isBefore, startOfDay, parseISO, addDays, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, Scale, ShieldCheck, FileSearch, Upload, CheckCircle2, X, AlertTriangle, FileBadge, UserX, Info, Image as ImageIcon } from 'lucide-react';
import type { Employee, OvertimeRecord, PermitRequest } from '@/lib/types';

const ACTIONS = [
  "101 - TRASLADO",
  "102 - DESCUENTO-RETENCION",
  "103 - ANTICIPO DE SALARIO",
  "104 - ANTICIPO DE PAGO DE VACACION",
  "105 - PAGO DE INDEMNIZACION",
  "106 - LIQUIDACION LABORAL",
  "107 - PERMISO CON GOCE DE SUELDO",
  "108 - PERMISO SIN GOCE DE SUELDO",
  "109 - VACACIONES",
  "110 - PAGO DE VACACIONES",
  "111 - INCAPACIDAD",
  "112 - MATERNIDAD",
  "113 - CITAS MEDICAS",
  "114 - AMONESTACION",
  "115 - SUSPENSION",
  "116 - RENUNCIA",
  "117 - DESPIDO",
  "118 - ABANDONO LABORAL",
  "119 - SEPELIO HASTA 3ER GRADO",
  "120 - OTROS..."
];

const EVENTUALITIES = [
  "SALUD / ENFERMEDAD",
  "TRÁMITE LEGAL / PERSONAL",
  "PROBLEMA DE TRANSPORTE",
  "CALAMIDAD DOMÉSTICA",
  "DUELO",
  "FUERZA MAYOR (LLUVIA, BLOQUEO)",
  "SIN JUSTIFICANTE / OLVIDO",
  "OTRO..."
];

const FormSchema = z.object({
  startDate: z.string().min(1, "Fecha de inicio requerida"),
  endDate: z.string().min(1, "Fecha de fin requerida"),
  action: z.string().min(1, "Acción requerida"),
  supervisorName: z.string().min(1, "Debe seleccionar un jefe inmediato"),
  justification: z.string().min(10, "Justificación mínima de 10 caracteres"),
  position: z.string().min(1, "Puesto requerido"),
  evidence: z.string().optional(),
  eventuality: z.string().optional(),
}).refine((data) => {
  const start = parseISO(data.startDate);
  const end = parseISO(data.endDate);
  return end >= start;
}, {
  message: "La fecha de fin no puede ser anterior a la de inicio",
  path: ["endDate"],
});

interface PermitFormProps {
  onSuccess: () => void;
  defaultAction?: string;
}

export function PermitForm({ onSuccess, defaultAction }: PermitFormProps) {
  const { toast } = useToast();
  const [user, setUser] = useState<{ name: string; month: string } | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [myData, setMyData] = useState<Employee | null>(null);
  const [existingRecords, setExistingRecords] = useState<OvertimeRecord[]>([]);
  const [myPermits, setMyPermits] = useState<PermitRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fileDataUri, setFileDataUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'pdf' | 'image' | null>(null);

  const isInasistencia = defaultAction === 'INASISTENCIA';

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      action: defaultAction || "",
      supervisorName: "",
      justification: "",
      position: "",
      evidence: "",
      eventuality: "",
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    }
  });

  const { control, watch, setValue, handleSubmit } = form;
  const watchedStartDate = watch('startDate');

  useEffect(() => {
    if (watchedStartDate) {
      const start = parseISO(watchedStartDate);
      if (isValid(start)) {
        const nextDay = addDays(start, 1);
        setValue('endDate', format(nextDay, 'yyyy-MM-dd'));
      }
    }
  }, [watchedStartDate, setValue]);

  useEffect(() => {
    const stored = localStorage.getItem('overtimeUser');
    if (stored) {
      const parsed = JSON.parse(stored);
      setUser(parsed);
      
      const fetchData = async () => {
        try {
          const [empRes, recRes, perRes] = await Promise.all([
            fetch('/api/employees'),
            fetch(`/api/overtime/records?month=${encodeURIComponent(parsed.month)}`),
            fetch(`/api/permits?user=${encodeURIComponent(parsed.name)}`)
          ]);
          
          const emps = await empRes.json();
          const recs = await recRes.json();
          const pers = await perRes.json();
          
          const activeEmps = Array.isArray(emps) ? emps.filter((e: Employee) => e.status === 'active') : [];
          const me = activeEmps.find((e: Employee) => e.name === parsed.name);
          
          if (me) {
            setMyData(me);
            form.setValue('position', me.position || 'Colaborador');
            const supervisors = activeEmps.filter((e: Employee) => 
                e.isSupervisor === true && 
                e.branch === me.branch && 
                e.name !== me.name
            );
            setEmployees(supervisors);
          }
          setExistingRecords(Array.isArray(recs) ? recs : []);
          setMyPermits(Array.isArray(pers) ? pers.filter(p => p.employeeName === parsed.name && p.status !== 'rejected') : []);
        } catch (e) {
          console.error(e);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [form]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      toast({ 
        variant: 'destructive', 
        title: 'Archivo no permitido', 
        description: 'Solo se permiten archivos PDF o Imágenes (JPG, PNG).' 
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
    if (!user || !myData) return;

    const today = startOfDay(new Date());
    const start = startOfDay(parseISO(data.startDate));

    if (isInasistencia) {
      if (isAfter(start, today)) {
        toast({
          variant: 'destructive',
          title: 'Fecha Inválida',
          description: 'No puedes reportar una inasistencia para una fecha futura.'
        });
        return;
      }
    } else {
      if (isBefore(start, today)) {
        toast({
          variant: 'destructive',
          title: 'Fecha Inválida',
          description: 'Los permisos deben solicitarse para fechas presentes o futuras.'
        });
        return;
      }
    }

    const hourConflict = existingRecords.find(rec => {
      const recDateStr = format(new Date(rec.date), 'yyyy-MM-dd');
      return recDateStr === data.startDate || recDateStr === data.endDate;
    });

    if (hourConflict) {
      toast({
        variant: 'destructive',
        title: 'Conflicto detectado',
        description: `Ya tienes horas extra registradas para el día ${format(new Date(hourConflict.date), 'dd/MM')}. No puedes registrar una inasistencia o permiso en un día trabajado.`,
      });
      return;
    }

    const duplicateConflict = myPermits.find(p => {
        return (data.startDate >= p.startDate && data.startDate <= p.endDate) ||
               (data.endDate >= p.startDate && data.endDate <= p.endDate);
    });

    if (duplicateConflict) {
        toast({
            variant: 'destructive',
            title: 'Día Ocupado',
            description: `Ya tienes un registro de ${duplicateConflict.action} para esta fecha. No puedes duplicar solicitudes el mismo día.`
        });
        return;
    }

    try {
      const response = await fetch('/api/permits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          employeeName: user.name,
          branch: myData.branch,
          evidenceFileDataUri: fileDataUri
        })
      });

      if (response.ok) {
        toast({ title: 'Solicitud Enviada', description: 'Tu jefe inmediato ha sido notificado.' });
        onSuccess();
      } else {
        throw new Error("Error al enviar");
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar la solicitud.' });
    }
  }

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></div>;

  return (
    <Card className="border-none shadow-none sm:border-2 sm:border-primary/10 sm:shadow-lg">
      <CardHeader className="bg-primary/5 border-b px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3">
            <div className={isInasistencia ? "bg-red-600 text-white p-2 rounded-lg" : "bg-primary text-white p-2 rounded-lg"}>
                {isInasistencia ? <FileSearch className="h-5 w-5" /> : <Scale className="h-5 w-5" />}
            </div>
            <div>
                <CardTitle className="text-lg sm:text-xl">{isInasistencia ? 'Reporte de Inasistencia' : 'Solicitud de Acción de Personal'}</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {isInasistencia ? 'Registra una falta que ya ocurrió.' : 'Solicita un trámite para una fecha futura.'}
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
                    name="position"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Puesto de Trabajo</FormLabel>
                            <FormControl><Input placeholder="Ej: Gestor de Cobros" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={control}
                    name="action"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Acción / Trámite</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={isInasistencia}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Selecciona el tipo" /></SelectTrigger>
                                </FormControl>
                                <SelectContent className="max-h-[300px]">
                                    {isInasistencia ? (
                                      <SelectItem value="INASISTENCIA">INASISTENCIA</SelectItem>
                                    ) : (
                                      ACTIONS.map(action => <SelectItem key={action} value={action}>{action}</SelectItem>)
                                    )}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            {isInasistencia && (
              <FormField
                control={control}
                name="eventuality"
                render={({ field }) => (
                  <FormItem className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <FormLabel>Tipo de Eventualidad</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecciona la causa" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EVENTUALITIES.map(ev => <SelectItem key={ev} value={ev}>{ev}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={control}
                    name="startDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{isInasistencia ? 'Día de la Falta' : 'Desde (Fecha)'}</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name="endDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{isInasistencia ? 'Día de Retorno' : 'Hasta (Fecha)'}</FormLabel>
                            <FormControl>
                              <Input 
                                type="date" 
                                min={watchedStartDate}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <FormField
                control={control}
                name="supervisorName"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            Jefe Inmediato Autorizador
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Selecciona el jefe o responsable" /></SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[300px]">
                                <SelectItem value="SIN AUTORIZACION" className="text-red-600 font-bold">
                                    <div className="flex items-center gap-2">
                                        <UserX className="h-4 w-4" />
                                        <span>SIN AUTORIZACION PREVIA</span>
                                    </div>
                                </SelectItem>
                                {employees.map(emp => (
                                    <SelectItem key={emp.id} value={emp.name}>
                                        <div className="flex items-center gap-2">
                                            <span>{emp.name}</span>
                                            <Badge variant="outline" className="text-[8px] h-4">JEFE {emp.branch}</Badge>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormDescription className="text-[10px]">
                            Selecciona "SIN AUTORIZACION" si faltaste sin previo aviso a tu jefatura.
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="justification"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Explicación del Motivo</FormLabel>
                        <FormControl><Textarea placeholder="Describe detalladamente por qué faltaste o por qué solicitas el permiso..." className="min-h-[100px]" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <div className="space-y-4">
                <FormLabel>Justificante Digital (PDF o Imagen)</FormLabel>
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
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { setFileDataUri(null); setFileName(null); setFileType(null); }}><X className="h-4 w-4" /></Button>
                  </div>
                )}
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 shadow-sm">
                <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-xs font-black uppercase text-amber-800 tracking-wider flex items-center gap-2">
                        <Scale className="h-3 w-3" /> Aviso de Validez Administrativa
                    </p>
                    <p className="text-[11px] text-amber-900 leading-relaxed italic">
                        La presentación de este formulario constituye una solicitud formal y <strong>no garantiza la aprobación automática</strong> de la acción de personal. Toda solicitud está estrictamente sujeta a la revisión, validación y dictamen final por parte del departamento de Administración y la Gerencia General. El colaborador debe esperar la notificación oficial de resolución antes de proceder con el trámite solicitado.
                    </p>
                </div>
            </div>

            <Button 
                type="submit" 
                className={isInasistencia ? "w-full h-12 gap-2 text-lg shadow-xl bg-red-600 hover:bg-red-700" : "w-full h-12 gap-2 text-lg shadow-xl"} 
                disabled={form.formState.isSubmitting}
            >
                {form.formState.isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
                {isInasistencia ? 'Enviar Reporte de Falta' : 'Enviar Solicitud de Permiso'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
