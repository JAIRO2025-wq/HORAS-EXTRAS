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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { months } from '@/lib/data';
import { useRouter } from 'next/navigation';
import {
  Calendar as CalendarIcon,
  LogIn,
  KeyRound,
  Loader2
} from 'lucide-react';
import { useState } from 'react';
import { Input } from '../ui/input';

const FormSchema = z.object({
  pin: z.string().min(4, 'El PIN debe tener al menos 4 dígitos.').max(6, 'El PIN no puede exceder los 6 dígitos.'),
  month: z.string().min(1, 'Por favor selecciona un mes.'),
});

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const currentMonth = months[new Date().getMonth()];

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      pin: '',
      month: currentMonth,
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: data.pin, month: data.month }),
      });

      const result = await response.json();

      if (response.ok) {
        if (result.type === 'admin') {
          localStorage.setItem('overtimeAdmin', JSON.stringify({ 
            admin: true, 
            role: result.user.role,
            name: result.user.name,
            month: data.month 
          }));
          toast({ title: 'Acceso Administrativo', description: `Bienvenido, ${result.user.name}` });
          router.push('/admin/dashboard');
        } else {
          localStorage.setItem('overtimeUser', JSON.stringify({ 
            name: result.user.name, 
            month: data.month 
          }));
          toast({ title: '¡Hola!', description: `Has iniciado sesión como ${result.user.name}` });
          router.push('/dashboard');
        }
      } else {
        toast({ 
          variant: 'destructive', 
          title: 'PIN no válido', 
          description: result.error || 'Verifica tu PIN e intenta de nuevo.' 
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
          name="pin"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-center block text-muted-foreground uppercase text-sm font-bold tracking-widest">Ingresa tu PIN de Acceso</FormLabel>
              <FormControl>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40" />
                  <Input 
                    type="password" 
                    placeholder="Escribe tu código aquí" 
                    className="pl-10 h-14 text-center text-2xl font-mono tracking-[0.5em] border-2 focus:border-primary transition-all placeholder:tracking-normal placeholder:text-sm" 
                    maxLength={6} 
                    {...field} 
                    autoFocus
                  />
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
              <FormLabel className="text-center block text-muted-foreground uppercase text-sm font-bold tracking-widest">Mes de Trabajo</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <SelectTrigger className="pl-10 h-11"><SelectValue /></SelectTrigger>
                  </div>
                </FormControl>
                <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" className="w-full h-12 text-sm font-bold shadow-xl" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <LogIn className="mr-2 h-5 w-5" />}
          Ingresar al Sistema
        </Button>
      </form>
    </Form>
  );
}
