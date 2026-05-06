'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { OfflineManager } from '@/lib/offline-manager';
import { WifiOff, CloudUpload, Download, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function PWAHandler() {
  const [isOffline, setIsOffline] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const { toast } = useToast();
  
  // Referencia para rastrear qué usuario está suscrito en esta sesión
  const lastSubscribedUser = useRef<string | null>(null);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeUserToPush = useCallback(async (registration: ServiceWorkerRegistration) => {
    try {
      if (!('pushManager' in registration)) return;

      const storedUser = localStorage.getItem('overtimeUser');
      const storedAdmin = localStorage.getItem('overtimeAdmin');
      
      let name = "";
      if (storedUser) {
        name = JSON.parse(storedUser).name;
      } else if (storedAdmin) {
        name = JSON.parse(storedAdmin).name;
      }

      if (!name) {
        console.log('[PWA] No hay usuario activo para suscribir.');
        return;
      }

      // Si ya suscribimos a este usuario en esta sesión, no repetimos a menos que cambie
      if (lastSubscribedUser.current === name) return;

      console.log(`[PWA] Sincronizando dispositivo para: ${name}`);

      // 1. Limpiar suscripción existente para evitar conflictos de identidad en el mismo equipo
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        await existingSubscription.unsubscribe();
      }

      // 2. Obtener nueva llave pública
      const response = await fetch('/api/push/keys');
      if (!response.ok) throw new Error('Error al obtener llaves VAPID');
      const { publicKey } = await response.json();

      // 3. Suscribir nuevamente
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // 4. Vincular en el servidor con el nuevo nombre
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, employeeName: name })
      });
      
      lastSubscribedUser.current = name;
      console.log(`[PWA] Dispositivo vinculado con éxito a: ${name}`);
    } catch (error) {
      console.error('[PWA] Error crítico en suscripción Push:', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then((reg) => {
            console.log('[PWA] Service Worker registrado');
            
            // Verificación periódica del usuario activo para manejar cambios de cuenta
            const checkAndSubscribe = () => {
              const hasUser = localStorage.getItem('overtimeUser') || localStorage.getItem('overtimeAdmin');
              if (Notification.permission === 'granted' && hasUser) {
                subscribeUserToPush(reg);
              }
            };

            checkAndSubscribe();
            // Revisar cada 10 segundos si cambió el usuario en el mismo dispositivo
            const interval = setInterval(checkAndSubscribe, 10000);
            return () => clearInterval(interval);
          });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }

    const handleManualSubscribe = () => {
      navigator.serviceWorker.ready.then(reg => subscribeUserToPush(reg));
    };
    window.addEventListener('trigger-push-subscription', handleManualSubscribe);

    const handleInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    const handleOnline = () => {
      setIsOffline(false);
      OfflineManager.sync((desc) => {
        toast({ 
          title: "Sincronizado", 
          description: desc, 
          icon: <CloudUpload className="h-4 w-4 text-blue-500" /> 
        });
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', () => setIsOffline(true));
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('trigger-push-subscription', handleManualSubscribe);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', () => setIsOffline(true));
    };
  }, [toast, subscribeUserToPush]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <>
      {isOffline && (
        <div className="fixed bottom-4 left-4 z-[100] animate-bounce">
          <Badge variant="destructive" className="gap-2 px-3 py-1.5 shadow-lg border-2 border-white">
            <WifiOff className="h-3.5 w-3.5" />
            Modo Offline Activo
          </Badge>
        </div>
      )}

      {showInstallBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md animate-in slide-in-from-top-full duration-500">
          <div className="bg-primary text-primary-foreground p-4 rounded-2xl shadow-2xl flex items-center gap-4 border-2 border-white/20 backdrop-blur-lg">
            <div className="bg-white/20 p-2 rounded-xl">
              <Download className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold leading-tight">Instalar Aplicación</p>
              <p className="text-[10px] opacity-80">Para una mejor experiencia administrativa.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" className="h-8 text-xs font-bold" onClick={handleInstallClick}>
                Instalar
              </Button>
              <button onClick={() => setShowInstallBanner(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
