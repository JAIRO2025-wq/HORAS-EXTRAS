'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Fingerprint, UserCog } from 'lucide-react';

type Props = {
  name: string;
  mode?: 'new' | 'update';
  onClose: () => void;
  onEnrolled: () => void;
};

type PersonalFields = {
  dui: string;
  email: string;
  nit: string;
  edad: string;
  sexo: string;
  nacionalidad: string;
  estadoFamiliar: string;
  profesion: string;
  domicilio: string;
  residencia: string;
  lugarExpedicionDui: string;
  fechaExpedicionDui: string;
};

const EMPTY_FORM: PersonalFields = {
  dui: '',
  email: '',
  nit: '',
  edad: '',
  sexo: '',
  nacionalidad: '',
  estadoFamiliar: '',
  profesion: '',
  domicilio: '',
  residencia: '',
  lugarExpedicionDui: '',
  fechaExpedicionDui: '',
};

export function SignatureEnrollment({ name, mode = 'new', onClose, onEnrolled }: Props) {
  const [form, setForm] = useState<PersonalFields>(EMPTY_FORM);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const setField = (key: keyof PersonalFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const setSelect = (key: keyof PersonalFields) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Prellenar el formulario con los datos actuales del empleado.
  useEffect(() => {
    (async () => {
      try {
        const [empRes, certRes] = await Promise.all([
          fetch('/api/employees'),
          fetch('/api/certificados/estado'),
        ]);

        if (empRes.ok) {
          const employees = await empRes.json();
          const me = employees.find(
            (e: any) => e.name?.toUpperCase() === name.toUpperCase()
          );
          if (me) {
            setForm((f) => ({
              ...f,
              dui: f.dui || me.dui || '',
              nit: me.nit || '',
              edad: me.edad || '',
              sexo: me.sexo || '',
              nacionalidad: me.nacionalidad || '',
              estadoFamiliar: me.estadoFamiliar || '',
              profesion: me.profesion || '',
              domicilio: me.domicilio || '',
              residencia: me.residencia || '',
              lugarExpedicionDui: me.lugarExpedicionDui || '',
              fechaExpedicionDui: me.fechaExpedicionDui || '',
            }));
          }
        }

        if (certRes.ok) {
          const cert = await certRes.json();
          if (cert.enrolled) {
            setForm((f) => ({ ...f, dui: f.dui || cert.dui || '', email: cert.email || '' }));
          }
        }
      } catch (error) {
        console.error('No se pudieron cargar los datos del empleado', error);
      }
    })();
  }, [name]);

  const guardar = async () => {
    if (!form.dui.trim() || !form.email.trim()) {
      toast({ variant: 'destructive', title: 'Datos incompletos', description: 'Ingresa tu DUI y correo.' });
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      toast({ variant: 'destructive', title: 'PIN inválido', description: 'El PIN debe tener 6 dígitos.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/certificados/enrolar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, pin, update: mode === 'update' }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: mode === 'update' ? 'Datos actualizados' : 'Firma activada',
          description:
            mode === 'update'
              ? 'Tu información y certificado fueron actualizados correctamente.'
              : 'Tu certificado digital fue generado correctamente.',
        });
        onEnrolled();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: data.error || 'No se pudo guardar la información.' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Error de conexión.' });
    } finally {
      setLoading(false);
    }
  };

  const isUpdate = mode === 'update';

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isUpdate ? <UserCog className="h-5 w-5 text-primary" /> : <Fingerprint className="h-5 w-5 text-primary" />}
            {isUpdate ? 'Actualizar Mis Datos' : 'Activar Firma Digital'}
          </DialogTitle>
          <DialogDescription>
            {isUpdate
              ? 'Actualiza tu información personal. Esto también actualiza tu certificado de firma digital.'
              : 'Completa tus datos y define un PIN de 6 dígitos para firmar tus recibos.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input value={name} disabled className="bg-muted" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dui">DUI / RUT *</Label>
              <Input id="dui" placeholder="00000000-0" value={form.dui} onChange={setField('dui')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nit">NIT</Label>
              <Input id="nit" placeholder="0000-000000-000-0" value={form.nit} onChange={setField('nit')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo electrónico *</Label>
              <Input id="email" type="email" placeholder="tucorreo@ejemplo.com" value={form.email} onChange={setField('email')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edad">Edad</Label>
              <Input id="edad" inputMode="numeric" placeholder="25" value={form.edad} onChange={setField('edad')} />
            </div>
            <div className="space-y-1.5">
              <Label>Sexo</Label>
              <Select value={form.sexo} onValueChange={setSelect('sexo')}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Masculino">Masculino</SelectItem>
                  <SelectItem value="Femenino">Femenino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nacionalidad">Nacionalidad</Label>
              <Input id="nacionalidad" placeholder="salvadoreño" value={form.nacionalidad} onChange={setField('nacionalidad')} />
            </div>
            <div className="space-y-1.5">
              <Label>Estado familiar</Label>
              <Select value={form.estadoFamiliar} onValueChange={setSelect('estadoFamiliar')}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Soltero">Soltero</SelectItem>
                  <SelectItem value="Casado">Casado</SelectItem>
                  <SelectItem value="Divorciado">Divorciado</SelectItem>
                  <SelectItem value="Viudo">Viudo</SelectItem>
                  <SelectItem value="Unión Libre">Unión Libre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profesion">Profesión / Oficio</Label>
              <Input id="profesion" placeholder="contador público" value={form.profesion} onChange={setField('profesion')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="domicilio">Domicilio</Label>
              <Input id="domicilio" placeholder="san miguel" value={form.domicilio} onChange={setField('domicilio')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="residencia">Residencia</Label>
              <Input id="residencia" placeholder="san miguel" value={form.residencia} onChange={setField('residencia')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lugarExpedicionDui">Lugar de expedición del DUI</Label>
              <Input id="lugarExpedicionDui" placeholder="San Miguel" value={form.lugarExpedicionDui} onChange={setField('lugarExpedicionDui')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fechaExpedicionDui">Fecha de expedición del DUI</Label>
              <Input id="fechaExpedicionDui" type="date" value={form.fechaExpedicionDui} onChange={setField('fechaExpedicionDui')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pin">PIN de firma (6 dígitos) *</Label>
            <Input
              id="pin"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="text-center tracking-[0.5em] font-mono"
            />
            <p className="text-xs text-muted-foreground">Este PIN protege tu certificado. No lo compartas.</p>
          </div>

          <Button className="w-full gap-2" onClick={guardar} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isUpdate ? <UserCog className="h-4 w-4" /> : <Fingerprint className="h-4 w-4" />}
            {isUpdate ? 'Guardar cambios' : 'Activar Firma'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
