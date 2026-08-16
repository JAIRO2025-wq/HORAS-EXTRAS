'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import SignatureCanvas, { type SignatureCanvasHandle } from '@/components/ui/signature-canvas';
import { Loader2, Mail, PenLine, ShieldCheck, Eraser } from 'lucide-react';

type Stub = {
  year: number;
  month: string;
  quincena: number;
};

type Props = {
  stub: Stub;
  onClose: () => void;
  onSigned: () => void;
};

export function PaystubSignDialog({ stub, onClose, onSigned }: Props) {
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState('');
  const [solicitando, setSolicitando] = useState(false);
  const [firmando, setFirmando] = useState(false);
  const [otpEnviado, setOtpEnviado] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const sigRef = useRef<SignatureCanvasHandle>(null);
  const { toast } = useToast();

  const solicitarOtp = async () => {
    if (!/^\d{6}$/.test(pin)) {
      toast({ variant: 'destructive', title: 'PIN inválido', description: 'Ingresa tu PIN de firma de 6 dígitos.' });
      return;
    }
    setSolicitando(true);
    try {
      const res = await fetch('/api/otp/solicitar', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setOtpEnviado(true);
        setDevCode(data.devCode ?? null);
        toast({ title: 'Código enviado', description: 'Revisa tu correo e ingresa el código de 6 dígitos.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: data.error || 'No se pudo enviar el código.' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Error de conexión.' });
    } finally {
      setSolicitando(false);
    }
  };

  const firmar = async () => {
    if (sigRef.current?.isEmpty()) {
      toast({ variant: 'destructive', title: 'Rúbrica requerida', description: 'Dibuja tu rúbrica antes de firmar.' });
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      toast({ variant: 'destructive', title: 'PIN inválido', description: 'Ingresa tu PIN de firma de 6 dígitos.' });
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      toast({ variant: 'destructive', title: 'OTP inválido', description: 'Ingresa el código de 6 dígitos.' });
      return;
    }

    setFirmando(true);
    try {
      const res = await fetch('/api/firmas/firmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: stub.year,
          month: stub.month,
          quincena: stub.quincena,
          pin,
          otp,
          rubricaDataUri: sigRef.current?.toDataURL(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Recibo firmado', description: 'Tu firma digital fue aplicada correctamente.' });
        onSigned();
      } else {
        toast({ variant: 'destructive', title: 'No se pudo firmar', description: data.error || 'Intenta de nuevo.' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Error de conexión.' });
    } finally {
      setFirmando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Firmar Recibo
          </DialogTitle>
          <DialogDescription>
            {stub.month} - Quincena {stub.quincena} ({stub.year})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Rúbrica */}
          <div>
            <Label className="flex items-center gap-1.5 mb-2">
              <PenLine className="h-3.5 w-3.5" /> Tu rúbrica
            </Label>
            <div className="relative rounded-lg border-2 border-dashed border-muted-foreground/30 bg-white overflow-hidden">
              <SignatureCanvas
                ref={sigRef}
                className="w-full h-40 cursor-crosshair"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute bottom-2 right-2 h-7 gap-1 text-xs"
                onClick={() => sigRef.current?.clear()}
              >
                <Eraser className="h-3.5 w-3.5" /> Limpiar
              </Button>
            </div>
          </div>

          {/* PIN */}
          <div className="space-y-1.5">
            <Label htmlFor="pin">PIN de firma (6 dígitos)</Label>
            <Input
              id="pin"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="text-center tracking-[0.5em] font-mono"
            />
          </div>

          {/* OTP */}
          <div className="space-y-1.5">
            <Label htmlFor="otp" className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Código de verificación
            </Label>
            <div className="flex gap-2">
              <Input
                id="otp"
                inputMode="numeric"
                maxLength={6}
                placeholder="Código de 6 dígitos"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="text-center tracking-[0.5em] font-mono"
              />
              <Button type="button" variant="outline" onClick={solicitarOtp} disabled={solicitando} className="shrink-0">
                {solicitando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Solicitar'}
              </Button>
            </div>
            {otpEnviado && (
              <p className="text-xs text-muted-foreground">
                Código enviado a tu correo. Expira en 5 minutos.
                {devCode && <span className="block text-primary">Desarrollo: {devCode}</span>}
              </p>
            )}
          </div>

          <Button className="w-full gap-2" onClick={firmar} disabled={firmando}>
            {firmando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Firmar Recibo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
