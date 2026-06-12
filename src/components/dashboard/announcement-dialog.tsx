'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Megaphone, ShieldAlert, CheckCircle2, X } from 'lucide-react';
import { isAfter, startOfDay } from 'date-fns';

/**
 * Diálogo de Anuncio para la Circular Informativa de RRHH.
 * Se muestra al entrar al sistema basándose en sessionStorage.
 */
export function AnnouncementDialog() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // 1. Verificamos la fecha actual. 
    // El cartel debe desaparecer el 14 de Junio de 2026.
    const expirationDate = startOfDay(new Date(2026, 5, 14)); // 14 de Junio, 2026
    if (isAfter(new Date(), expirationDate)) {
      return;
    }

    // 2. Verificamos si ya vio la circular en esta sesión
    const hasSeenCircular = sessionStorage.getItem('overtime_circular_june_2026');
    if (!hasSeenCircular) {
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    sessionStorage.setItem('overtime_circular_june_2026', 'true');
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) handleClose();
    }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-0 space-y-0 relative">
          <button 
            onClick={handleClose}
            className="absolute right-4 top-4 z-10 p-2 rounded-full bg-black/10 text-white hover:bg-black/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="bg-primary p-6 text-primary-foreground flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-full">
              <Megaphone className="h-8 w-8 text-white animate-bounce" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black tracking-tighter uppercase leading-none text-primary-foreground">
                Circular Informativa
              </DialogTitle>
              <DialogDescription className="text-xs font-bold opacity-80 mt-1 uppercase tracking-widest text-primary-foreground/80">
                Recursos Humanos - Notificación Oficial
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="p-8 space-y-6 bg-white text-zinc-800">
          <div className="flex items-start gap-4 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg shadow-sm">
            <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-amber-900 leading-relaxed">
              Importante: Nueva política estricta de registro de jornadas laborales a partir del 15 de Junio de 2026.
            </p>
          </div>

          <div className="space-y-4 text-sm leading-relaxed text-zinc-600 text-justify">
            <p>
              Se comunica a todos los usuarios que, a partir del <strong>15 de junio de 2026</strong>, el sistema únicamente aceptará registros cuya fecha coincida con el día efectivo en que se realizaron las horas extras.
            </p>
            <p>
              Actualmente se ha detectado que algunos usuarios ingresan registros con varios días de retraso, lo cual genera inconsistencias en los cálculos automáticos de las planillas. Con esta actualización, <strong>cualquier registro fuera de plazo será rechazado por el sistema</strong>.
            </p>
            <p>
              La medida busca asegurar la precisión de la información y la correcta ejecución de los procesos automatizados. Se solicita a todos los usuarios realizar sus anotaciones en <strong>tiempo real</strong>, el mismo día en que se efectúe la labor.
            </p>
          </div>

          <div className="pt-6 border-t flex flex-col items-center gap-2">
            <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Atentamente,</p>
            <p className="text-xs font-bold text-zinc-700 uppercase">Departamento de Recursos Humanos</p>
          </div>
        </div>

        <DialogFooter className="p-6 bg-zinc-50 border-t">
          <Button onClick={handleClose} className="w-full h-12 text-lg font-bold gap-2 shadow-lg hover:scale-[1.02] transition-transform">
            <CheckCircle2 className="h-5 w-5" /> He leído y comprendo la circular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
