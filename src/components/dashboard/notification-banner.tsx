'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { BellRing, BellOff, X, Info, Apple } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function NotificationBanner() {
  const [status, setStatus] = useState<NotificationPermission | 'not-supported'>('default');
  const [isVisible, setIsVisible] = useState(true);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detectar iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    if (!('Notification' in window)) {
      setStatus('not-supported');
      return;
    }

    setStatus(Notification.permission);

    // Revisar periódicamente por si cambian los permisos
    const interval = setInterval(() => {
      setStatus(Notification.permission);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleRequest = async () => {
    if (typeof window === 'undefined') return;
    
    try {
      // LLAMADA DIRECTA: El navegador requiere que esto ocurra en el hilo del click
      const permission = await Notification.requestPermission();
      setStatus(permission);
      
      if (permission === 'granted') {
        // Una vez concedido, avisamos al PWAHandler para que registre la suscripción
        window.dispatchEvent(new CustomEvent('trigger-push-subscription'));
      }
    } catch (error) {
      console.error("Error solicitando permisos:", error);
    }
  };

  if (!isVisible || status === 'granted' || status === 'not-supported') {
    return null;
  }

  return (
    <Card className="mb-6 border-primary/20 bg-primary/5 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
      <CardContent className="p-0">
        <div className="p-4 flex items-start gap-4">
          <div className="bg-primary/10 p-3 rounded-full shrink-0">
            {status === 'denied' ? (
              <BellOff className="h-6 w-6 text-destructive" />
            ) : (
              <BellRing className="h-6 w-6 text-primary animate-pulse" />
            )}
          </div>
          
          <div className="flex-1 space-y-1">
            <h4 className="font-bold text-sm flex items-center gap-2">
              {status === 'denied' ? 'Avisos Bloqueados' : '¿Quieres recibir tus recibos al instante?'}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {status === 'denied' 
                ? 'Has bloqueado las notificaciones. Para recibir avisos de tus pagos, haz clic en el icono del "candado" junto a la dirección web y elige "Permitir".' 
                : 'Activa las notificaciones para que te avisemos en cuanto tu recibo de pago esté disponible en el sistema.'}
            </p>
            
            {isIOS && (
              <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-100 flex items-center gap-2">
                <Apple className="h-3 w-3 text-amber-700" />
                <span className="text-[10px] text-amber-800 font-medium">
                  En iPhone: Dale a "Compartir" y luego "Añadir a pantalla de inicio" para que funcionen.
                </span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {status === 'default' && (
                <Button size="sm" className="h-8 text-xs gap-2" onClick={handleRequest}>
                  <BellRing className="h-3 w-3" /> Activar Notificaciones
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setIsVisible(false)}>
                Quizás más tarde
              </Button>
            </div>
          </div>

          <button onClick={() => setIsVisible(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
