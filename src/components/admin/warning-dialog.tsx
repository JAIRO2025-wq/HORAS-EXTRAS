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
import { Loader2, Gavel, User, Calendar, CreditCard } from 'lucide-react';
import type { Employee, WarningRecord } from '@/lib/types';
import { format } from 'date-fns';

type WarningDialogProps = {
  employees: Employee[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function WarningDialog({ employees, isOpen, onOpenChange, onSaved }: WarningDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    employeeId: '',
    incidentDate: format(new Date(), 'yyyy-MM-dd'),
    dui: '',
    comments: ''
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        employeeId: '',
        incidentDate: format(new Date(), 'yyyy-MM-dd'),
        dui: '',
        comments: ''
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId || !formData.dui) {
      toast({ variant: 'destructive', title: 'Error', description: 'Empleado y DUI son obligatorios.' });
      return;
    }

    const selectedEmp = employees.find(e => e.id.toString() === formData.employeeId);
    if (!selectedEmp) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/warnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          employeeName: selectedEmp.name,
          position: selectedEmp.position || 'Colaborador',
          date: new Date().toISOString().split('T')[0]
        }),
      });

      if (response.ok) {
        toast({ title: 'Memorándum Generado', description: 'La amonestación ha sido guardada en el historial.' });
        onSaved();
        onOpenChange(false);
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error al guardar' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-primary" />
              Nueva Amonestación Escrita
            </DialogTitle>
            <DialogDescription>
              Completa los datos para generar el memorándum disciplinario oficial.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><User className="h-3 w-3" /> Empleado a Amonestar</Label>
              <Select value={formData.employeeId} onValueChange={(v) => setFormData(p => ({ ...p, employeeId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Busca al empleado..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id.toString()}>{e.name} (ID: {e.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Calendar className="h-3 w-3" /> Fecha de la Falta</Label>
                <Input type="date" value={formData.incidentDate} onChange={(e) => setFormData(p => ({ ...p, incidentDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><CreditCard className="h-3 w-3" /> DUI del Empleado</Label>
                <Input placeholder="00000000-0" value={formData.dui} onChange={(e) => setFormData(p => ({ ...p, dui: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Comentarios de Descargo (Espacio para el trabajador)</Label>
              <Textarea 
                placeholder="Este espacio aparecerá vacío en el PDF para que el empleado escriba a mano, o puedes digitarlo aquí si ya dio su declaración." 
                value={formData.comments}
                onChange={(e) => setFormData(p => ({ ...p, comments: e.target.value }))}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Generar Amonestación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
