'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  Mail, 
  MailOpen, 
  Trash2, 
  Loader2, 
  Clock, 
  CheckCheck,
  Inbox,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { UserNotification } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    
    // Polling cada 30 segundos para refrescar el buzón automáticamente
    const interval = setInterval(() => fetchNotifications(true), 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkRead = async (id: string, read: boolean) => {
    setIsProcessing(id);
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, read })
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read } : n));
        // Notificar a los layouts que deben refrescar sus contadores
        window.dispatchEvent(new CustomEvent('refresh-notifications'));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleMarkAllRead = async () => {
    setIsProcessing('all');
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true })
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        toast({ title: "Buzón actualizado", description: "Todos los mensajes marcados como leídos." });
        // Notificar a los layouts que deben refrescar sus contadores
        window.dispatchEvent(new CustomEvent('refresh-notifications'));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDelete = async (id: string) => {
    setIsProcessing(id);
    try {
      const res = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        toast({ title: "Mensaje eliminado" });
        // Notificar a los layouts que deben refrescar sus contadores
        window.dispatchEvent(new CustomEvent('refresh-notifications'));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(null);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Centro de Mensajes
          </h2>
          <p className="text-sm text-muted-foreground">Consulta los comunicados oficiales de la empresa.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => fetchNotifications(true)} disabled={isRefreshing} className="h-9 w-9 p-0">
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={isProcessing === 'all'} className="gap-2">
              {isProcessing === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              Marcar todo como leído
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        {notifications.length > 0 ? (
          notifications.map((n) => (
            <Card key={n.id} className={cn(
              "transition-all border-l-4",
              n.read ? "border-l-zinc-200 bg-muted/5 opacity-80" : "border-l-primary bg-background shadow-md ring-1 ring-primary/5"
            )}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "p-3 rounded-full shrink-0",
                    n.read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary animate-pulse"
                  )}>
                    {n.read ? <MailOpen className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className={cn("font-bold text-base truncate", !n.read && "text-primary")}>
                        {n.title}
                      </h3>
                      {!n.read && <Badge className="bg-primary text-white text-[9px] h-4">NUEVO</Badge>}
                    </div>
                    <p className="text-sm text-zinc-600 leading-relaxed mb-3">
                      {n.message}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(parseISO(n.date), "dd MMM, HH:mm", { locale: es })}
                      </span>
                      <span className="flex items-center gap-1">
                        Por: {n.sender}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(n.id)}
                      disabled={isProcessing === n.id}
                    >
                      {isProcessing === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                    {!n.read && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-primary"
                        onClick={() => handleMarkRead(n.id, true)}
                        disabled={isProcessing === n.id}
                      >
                        <CheckCheck className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-24 bg-muted/20 border-2 border-dashed rounded-3xl flex flex-col items-center">
            <div className="bg-muted p-6 rounded-full mb-4">
              <Inbox className="h-12 w-12 text-muted-foreground opacity-20" />
            </div>
            <h3 className="font-bold text-xl text-muted-foreground">Tu buzón está vacío</h3>
            <p className="text-sm text-muted-foreground/60 mt-1">No tienes mensajes ni notificaciones pendientes.</p>
          </div>
        )}
      </div>
    </div>
  );
}
