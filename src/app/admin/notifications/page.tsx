'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { 
  Bell, 
  Send, 
  Loader2, 
  Users, 
  Eye, 
  History, 
  RefreshCw, 
  CheckCircle2,
  Smartphone,
  Info,
  Trash2,
  Mail
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Employee, UserNotification } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import Image from 'next/image';
import { NotificationCenter } from '@/components/dashboard/notification-center';

export default function AdminNotificationsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [subscriptions, setSubscriptions] = useState<Record<string, any>>({});
  const [sentNotifications, setSentNotifications] = useState<UserNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const [targetEmployee, setTargetEmployee] = useState('all');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [viewMode, setViewMode] = useState<'send' | 'inbox'>('send');

  const fetchData = useCallback(async () => {
    try {
      const [empRes, subsRes] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/admin/notifications/subscriptions')
      ]);
      
      if (empRes.ok) {
        const data = await empRes.json();
        setEmployees(data.filter((e: Employee) => e.status === 'active'));
      }
      
      if (subsRes.ok) setSubscriptions(await subsRes.json());
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ variant: 'destructive', title: 'Campos requeridos', description: 'Por favor escribe un título y un mensaje.' });
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: targetEmployee,
          title,
          message,
          url: '/dashboard'
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error al enviar');

      toast({
        title: 'Envío Procesado',
        description: `Se enviaron ${result.count} mensajes correctamente.`
      });
      
      setTitle('');
      setMessage('');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error de Envío',
        description: (error as Error).message
      });
    } finally {
      setIsSending(false);
    }
  };

  const subscribedCount = Object.keys(subscriptions).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Centro de Comunicaciones
          </h1>
          <p className="text-muted-foreground text-sm">Gestiona comunicados masivos y personales.</p>
        </div>
        <div className="flex gap-2 bg-muted p-1 rounded-lg">
          <Button 
            variant={viewMode === 'send' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => setViewMode('send')}
            className="text-xs"
          >
            <Send className="h-3 w-3 mr-2" /> Redactar
          </Button>
          <Button 
            variant={viewMode === 'inbox' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => setViewMode('inbox')}
            className="text-xs"
          >
            <History className="h-3 w-3 mr-2" /> Mi Buzón
          </Button>
        </div>
      </div>

      {viewMode === 'inbox' ? (
        <NotificationCenter />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* FORMULARIO */}
          <Card className="lg:col-span-5 border-primary/10">
            <CardHeader>
              <CardTitle className="text-lg">Redactar Mensaje</CardTitle>
              <CardDescription>El mensaje se guardará en el buzón del empleado y se enviará como Push.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Destinatario</Label>
                <Select value={targetEmployee} onValueChange={setTargetEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un empleado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">📢 Todos los Empleados Activos</SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.name}>
                        {emp.name} {subscriptions[emp.name] ? ' (Push Activo ✅)' : ' (Solo Buzón 📥)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Título Corto</Label>
                <Input 
                  id="title" 
                  placeholder="Ej: Reunión Urgente" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={40}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Cuerpo del Mensaje</Label>
                <Textarea 
                  id="message" 
                  placeholder="Escribe el aviso aquí..." 
                  className="min-h-[120px] resize-none"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={250}
                />
              </div>

              <Button 
                className="w-full h-12 gap-2 text-lg shadow-lg" 
                onClick={handleSend} 
                disabled={isSending}
              >
                {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                {isSending ? 'Procesando...' : 'Enviar Comunicado'}
              </Button>
            </CardContent>
          </Card>

          {/* VISTA PREVIA */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
              <Card className="flex-1 bg-muted/20 border-dashed border-2">
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Eye className="h-4 w-4" /> Vista Previa del Buzón (Empleado)
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <div className="w-full max-w-md bg-background rounded-2xl border shadow-xl overflow-hidden">
                    <div className="bg-primary p-4 text-primary-foreground flex justify-between items-center">
                      <span className="font-bold text-sm">Notificaciones</span>
                      <Badge className="bg-white/20 text-white border-none">1</Badge>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="flex gap-3 border-l-4 border-l-primary p-3 bg-primary/5 rounded-r-lg">
                        <div className="bg-primary/10 p-2 rounded-full h-fit">
                          <Mail className="h-4 w-4 text-primary" />
                        </div>
                        <div className="space-y-1 flex-1">
                          <div className="flex justify-between">
                            <h4 className="text-sm font-bold text-primary">{title || 'Título del Mensaje'}</h4>
                            <span className="text-[10px] text-muted-foreground">Ahora</span>
                          </div>
                          <p className="text-xs text-zinc-600 line-clamp-2">
                            {message || 'El contenido de tu comunicado aparecerá aquí conforme lo redactes...'}
                          </p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase pt-1">
                            POR: ADMINISTRADOR
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-xs text-blue-800 space-y-1">
                  <p className="font-bold">Doble Canal de Comunicación</p>
                  <p>Al enviar un mensaje, este se guarda permanentemente en la base de datos para que el empleado lo vea en su "Buzón de Mensajes" aunque no tenga internet en ese momento. Si tiene las notificaciones Push activas, también recibirá la alerta en tiempo real.</p>
                </div>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}
