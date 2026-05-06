'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { KeyRound, LogIn, Calendar as CalendarIcon, ShieldCheck, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { months } from '@/lib/data';

const FormSchema = z.object({
  adminId: z.string().min(1, 'El perfil es requerido.'),
  pin: z.string().min(1, 'El PIN es requerido.').max(6, 'El PIN no puede exceder los 6 dígitos.'),
  month: z.string().min(1, 'Por favor selecciona un mes.'),
});

export function AdminLoginForm() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  const currentMonth = months[new Date().getMonth()];

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { adminId: '', pin: '', month: currentMonth },
  });

  useEffect(() => {
    fetch('/api/admin/admins')
        .then(res => res.json())
        .then(data => {
            if (Array.isArray(data)) {
              setAdmins(data);
            } else {
              setAdmins([]);
            }
            setIsLoading(false);
        })
        .catch(() => {
            setAdmins([]);
            setIsLoading(false);
        });
  }, []);

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: data.adminId, pin: data.pin }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({ title: 'Acceso Concedido', description: `¡Bienvenido, ${result.user.name}!` });
        
        // El estado del cliente sigue necesitando el mes y el rol para la UI
        localStorage.setItem(
          'overtimeAdmin',
          JSON.stringify({ 
            admin: true, 
            role: result.user.role,
            name: result.user.name,
            month: data.month 
          })
        );
        router.push('/admin/dashboard');
      } else {
        toast({
          variant: 'destructive',
          title: 'Error de Acceso',
          description: result.error || 'PIN incorrecto.',
        });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo conectar con el servidor.' });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="adminId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Perfil de Administrador</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                <FormControl>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <SelectTrigger className="pl-10">
                      <SelectValue placeholder={isLoading ? "Cargando perfiles..." : "Selecciona tu perfil"} />
                    </SelectTrigger>
                  </div>
                </FormControl>
                <SelectContent>
                  {Array.isArray(admins) && admins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                        {admin.name} ({admin.role === 'ADMIN_1' ? 'Control' : 'Gerencia'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="pin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>PIN de Acceso</FormLabel>
              <FormControl>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="password" placeholder="Ingresa tu PIN" className="pl-10" maxLength={6} {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="month"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mes de Análisis</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <SelectTrigger className="pl-10">
                      <SelectValue placeholder="Selecciona un mes" />
                    </SelectTrigger>
                  </div>
                </FormControl>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month} value={month}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-accent text-accent-foreground" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
          Acceder al Panel
        </Button>
      </form>
    </Form>
  );
}
