'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { OfflineManager } from '@/lib/offline-manager';
import { WifiOff, CloudUpload, Download, X, Share, PlusSquare, Apple } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function PWAHandler() {
  const [isOffline, setIsOffline] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const { toast } = useToast();
  
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

      if (!name) return;
      if (lastSubscribedUser.current === name) return;

      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        await existingSubscription.unsubscribe();
      }

      const response = await fetch('/api/push/keys');
      if (!response.ok) throw new Error('Error al obtener llaves VAPID');
      const { publicKey } = await response.json();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, employeeName: name })
      });
      
      lastSubscribedUser.current = name;
    } catch (error) {
      console.error('[PWA] Error en suscripción Push:', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detectar iOS Safari para mostrar guía de instalación manual
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;

    if (isIOS && !isStandalone) {
      const hasClosedBanner = sessionStorage.getItem('pwa_ios_banner_closed');
      if (!hasClosedBanner) {
        setShowIOSBanner(true);
      }
    }

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then((reg) => {
            const checkAndSubscribe = () => {
              const hasUser = localStorage.getItem('overtimeUser') || localStorage.getItem('overtimeAdmin');
              if (Notification.permission === 'granted' && hasUser) {
                subscribeUserToPush(reg);
              }
            };
            checkAndSubscribe();
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

  const closeIOSBanner = () => {
    sessionStorage.setItem('pwa_ios_banner_closed', 'true');
    setShowIOSBanner(false);
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

      {/* Banner para Android / Desktop Chrome */}
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

      {/* Banner de Guía para iPhone (iOS) */}
      {showIOSBanner && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-sm animate-in slide-in-from-bottom-full duration-700">
          <div className="bg-white text-zinc-900 p-5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-zinc-100">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-primary/10 p-2 rounded-xl">
                  <Apple className="h-5 w-5 text-primary" />
                </div>
                <span className="font-black text-sm uppercase tracking-tighter">Instalar en iPhone</span>
              </div>
              <button onClick={closeIOSBanner} className="bg-zinc-100 p-1 rounded-full text-zinc-400 hover:text-zinc-900 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-4 text-xs font-medium text-zinc-600">
              <div className="flex items-center gap-3 bg-zinc-50 p-3 rounded-2xl">
                <div className="bg-white p-2 rounded-lg shadow-sm border">
                  <Share className="h-4 w-4 text-blue-500" />
                </div>
                <p>1. Toca el botón <strong>"Compartir"</strong> en la barra inferior de Safari.</p>
              </div>
              
              <div className="flex items-center gap-3 bg-zinc-50 p-3 rounded-2xl">
                <div className="bg-white p-2 rounded-lg shadow-sm border">
                  <PlusSquare className="h-4 w-4 text-zinc-700" />
                </div>
                <p>2. Busca y elige <strong>"Añadir a la pantalla de inicio"</strong>.</p>
              </div>
            </div>
            
            <p className="text-[9px] text-center text-zinc-400 mt-4 uppercase font-bold tracking-widest">
              Esto permite recibir notificaciones de recibos
            </p>
          </div>
        </div>
      )}
    </>
  );
}
