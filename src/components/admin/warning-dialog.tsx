'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Gavel, User, Calendar, CreditCard, Building2, FileText, Hash } from 'lucide-react';
import type { Employee } from '@/lib/types';
import { CATALOGO_FALTAS } from '@/lib/faltas-catalogo';
import { format } from 'date-fns';

type WarningDialogProps = {
  employees: Employee[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

const defaultForm = {
  employeeId: '',
  numeroMemorandum: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  employeeName: '',
  pin: '',
  dui: '',
  cargo: '',
  department: '',
  tipoFalta: '',
  motivo: '',
  art31: '',
  art32: '',
  art50: '',
  incidentDate: format(new Date(), 'yyyy-MM-dd'),
  descripcion: '',
  representanteRrhh: '',
};

export function WarningDialog({ employees, isOpen, onOpenChange, onSaved }: WarningDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    if (isOpen) {
      setForm({
        ...defaultForm,
        numeroMemorandum: `/${new Date().getFullYear()}`,
      });
    }
  }, [isOpen]);

  const update = (patch: Partial<typeof defaultForm>) => setForm((p) => ({ ...p, ...patch }));

  const handleEmployeeChange = (id: string) => {
    const emp = employees.find((e) => e.id.toString() === id);
    if (!emp) {
      update({ employeeId: id });
      return;
    }
    update({
      employeeId: id,
      employeeName: emp.name,
      pin: emp.pin || emp.id.toString(),
      dui: emp.dui || '',
      cargo: emp.position || '',
      department: emp.branch || '',
    });
  };

  const handleTipoFaltaChange = (id: string) => {
    const falta = CATALOGO_FALTAS.find((f) => f.id === id);
    if (!falta) {
      update({ tipoFalta: id });
      return;
    }
    if (falta.id === 'otro') {
      update({ tipoFalta: id, motivo: '', art31: '', art32: '', art50: '', descripcion: '' });
    } else {
      update({
        tipoFalta: id,
        motivo: falta.motivo,
        art31: falta.art31,
        art32: falta.art32,
        art50: falta.art50,
        descripcion: falta.ejemplo,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeName || !form.dui || !form.tipoFalta) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'Empleado, DUI y tipo de falta son obligatorios.' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/warnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: form.employeeId || form.pin,
          employeeName: form.employeeName,
          dui: form.dui,
          position: form.cargo,
          department: form.department,
          numeroMemorandum: form.numeroMemorandum,
          date: form.date,
          incidentDate: form.incidentDate,
          tipoFalta: form.tipoFalta,
          motivo: form.motivo,
          art31: form.art31,
          art32: form.art32,
          art50: form.art50,
          descripcion: form.descripcion,
          representanteRrhh: form.representanteRrhh,
          comments: '',
        }),
      });

      if (response.ok) {
        toast({ title: 'Memorándum generado', description: 'La amonestación ha sido guardada en el historial.' });
        onSaved();
        onOpenChange(false);
      } else {
        throw new Error();
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error al guardar' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-primary" />
              Nuevo Memorándum Disciplinario
            </DialogTitle>
            <DialogDescription>
              Completa los datos del trabajador, el tipo de falta y la base legal. La ley aplicable se llena automáticamente según el tipo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Encabezado del memorándum */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Hash className="h-3 w-3" /> N.° Memorándum</Label>
                <Input placeholder="XX/2026" value={form.numeroMemorandum} onChange={(e) => update({ numeroMemorandum: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Calendar className="h-3 w-3" /> Fecha de emisión</Label>
                <Input type="date" value={form.date} onChange={(e) => update({ date: e.target.value })} />
              </div>
            </div>

            {/* Datos del trabajador */}
            <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
              <p className="text-xs font-bold uppercase text-muted-foreground">Datos del trabajador (quien recibe)</p>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><User className="h-3 w-3" /> Empleado</Label>
                <Select value={form.employeeId} onValueChange={handleEmployeeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Busca al empleado..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id.toString()}>{e.name}{e.position ? ` — ${e.position}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre completo</Label>
                  <Input value={form.employeeName} onChange={(e) => update({ employeeName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>ID / PIN</Label>
                  <Input value={form.pin} onChange={(e) => update({ pin: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><CreditCard className="h-3 w-3" /> DUI</Label>
                  <Input placeholder="00000000-0" value={form.dui} onChange={(e) => update({ dui: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Input value={form.cargo} onChange={(e) => update({ cargo: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Building2 className="h-3 w-3" /> Departamento / Área</Label>
                  <Input value={form.department} onChange={(e) => update({ department: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Tipo de falta y base legal */}
            <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
              <p className="text-xs font-bold uppercase text-muted-foreground">Tipo de falta y base legal</p>
              <div className="space-y-2">
                <Label>Tipo de falta</Label>
                <Select value={form.tipoFalta} onValueChange={handleTipoFaltaChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el tipo de falta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATALOGO_FALTAS.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><FileText className="h-3 w-3" /> Asunto (motivo resumido)</Label>
                <Input placeholder="AMONESTACIÓN ESCRITA POR ..." value={form.motivo} onChange={(e) => update({ motivo: e.target.value })} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Art. 31 (obligaciones)</Label>
                  <Input placeholder="ej. 2° y 10°" value={form.art31} onChange={(e) => update({ art31: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Art. 32 (prohibiciones)</Label>
                  <Input placeholder="ej. 2°" value={form.art32} onChange={(e) => update({ art32: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Art. 50 (despido)</Label>
                  <Input placeholder="ej. 12°" value={form.art50} onChange={(e) => update({ art50: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Hechos constatados */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Calendar className="h-3 w-3" /> Fecha del incidente (hechos constatados)</Label>
                <Input type="date" value={form.incidentDate} onChange={(e) => update({ incidentDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Descripción clara y objetiva del incidente</Label>
                <Textarea
                  placeholder="Describe la conducta contraria a las normativas laborales..."
                  value={form.descripcion}
                  onChange={(e) => update({ descripcion: e.target.value })}
                  className="min-h-[100px]"
                />
              </div>
            </div>

            {/* Firma del representante */}
            <div className="space-y-2">
              <Label>Nombre del Representante de RRHH</Label>
              <Input placeholder="Nombre de quien firma por la empresa" value={form.representanteRrhh} onChange={(e) => update({ representanteRrhh: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Generar Memorándum
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
