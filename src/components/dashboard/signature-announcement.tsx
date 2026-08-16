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
import { Fingerprint, BadgeCheck, FileSignature, X, CheckCircle2 } from 'lucide-react';

/**
 * Cartel informativo de una sola vista sobre la firma electrónica de recibos.
 * Se muestra al entrar al sistema basándose en sessionStorage.
 */
export function SignatureAnnouncement() {
  const [isOpen, setIsOpen] = useState(false);
  const STORAGE_KEY = 'flynet_signature_announcement_2026';

  useEffect(() => {
    const hasSeen = sessionStorage.getItem(STORAGE_KEY);
    if (!hasSeen) {
      const timer = setTimeout(() => setIsOpen(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    sessionStorage.setItem(STORAGE_KEY, 'true');
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
            className="absolute right-4 top-4 z-10 p-2 rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="bg-primary p-6 text-primary-foreground flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-full">
              <Fingerprint className="h-8 w-8 text-white animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black tracking-tighter uppercase leading-none text-primary-foreground">
                ¡Nuevo! Firma Electrónica de Recibos
              </DialogTitle>
              <DialogDescription className="text-xs font-bold opacity-80 mt-1 uppercase tracking-widest text-primary-foreground/80">
                Recursos Humanos - Notificación Oficial
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-5 bg-white text-zinc-800">
          <div className="flex items-start gap-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg shadow-sm">
            <FileSignature className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-blue-900 leading-relaxed">
              Ahora puedes firmar electrónicamente tu recibo de salario desde el sistema, sin necesidad de imprimirlo ni firmarlo a mano.
            </p>
          </div>

          <div className="space-y-3 text-sm leading-relaxed text-zinc-600 text-justify">
            <p>
              Para firmar tu recibo el sistema te genera un <strong>certificado digital personal</strong> con tus datos (DUI, nombre y correo). Este certificado es único, está protegido con tu PIN y es emitido por la autoridad certificadora interna de la empresa.
            </p>
            <p>
              Al firmar, recibirás un <strong>código de verificación (OTP)</strong> en tu correo electrónico como prueba de tu voluntad. Una vez validado, el recibo queda firmado con validez de <strong>firma digital PAdES</strong>: la misma validez legal que una firma manuscrita y con garantía de que nadie podrá alterar el documento.
            </p>
            <p>
              El sistema conserva el recibo firmado y su cadena de certificados para que puedas <strong>verificarlo en cualquier momento</strong> (por ejemplo, en Adobe Acrobat) y utilizarlo como comprobante oficial.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
              <BadgeCheck className="h-5 w-5 text-emerald-600 shrink-0" />
              <p className="text-xs font-bold text-emerald-800">Validez legal de firma manuscrita</p>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
              <Fingerprint className="h-5 w-5 text-emerald-600 shrink-0" />
              <p className="text-xs font-bold text-emerald-800">Certificado digital personal</p>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
              <FileSignature className="h-5 w-5 text-emerald-600 shrink-0" />
              <p className="text-xs font-bold text-emerald-800">Verificación en cualquier lector PDF</p>
            </div>
          </div>

          <div className="pt-4 border-t flex flex-col items-center gap-2">
            <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Atentamente,</p>
            <p className="text-xs font-bold text-zinc-700 uppercase">Departamento de Recursos Humanos</p>
          </div>
        </div>

        <DialogFooter className="p-6 bg-zinc-50 border-t">
          <Button onClick={handleClose} className="w-full h-12 text-lg font-bold gap-2 shadow-lg hover:scale-[1.02] transition-transform">
            <CheckCircle2 className="h-5 w-5" /> Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
