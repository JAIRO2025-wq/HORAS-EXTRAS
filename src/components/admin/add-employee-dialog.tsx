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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck } from 'lucide-react';
import type { Employee, Branch } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';

type EmployeeDialogProps = {
  employee?: Employee | null;
  onSave: (employee: Employee) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EmployeeDialog({
  employee,
  onSave,
  isOpen,
  onOpenChange,
}: EmployeeDialogProps) {
  const [name, setName] = useState('');
  const [salary, setSalary] = useState('');
  const [branch, setBranch] = useState('');
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const isEditMode = !!employee;

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch('/api/branches');
        if (!response.ok) throw new Error('Failed to fetch branches');
        setBranches(await response.json());
      } catch (error) {
        console.error("Failed to fetch branches", error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo cargar la lista de sucursales.',
        });
      }
    };

    if (isOpen) {
      fetchBranches();
      if (isEditMode && employee) {
        setName(employee.name);
        setSalary(employee.salary?.toString() || '');
        setBranch(employee.branch || '');
        setIsSupervisor(!!employee.isSupervisor);
      } else {
        setName('');
        setSalary('');
        setBranch('');
        setIsSupervisor(false);
      }
    }
  }, [employee, isEditMode, isOpen, toast]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const salaryNumber = parseFloat(salary);

    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error de Validación',
        description: 'El nombre del empleado no puede estar vacío.',
      });
      return;
    }
    if (!branch.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error de Validación',
        description: 'Por favor selecciona una sucursal.',
      });
      return;
    }
    if (isNaN(salaryNumber) || salaryNumber < 0) {
      toast({
        variant: 'destructive',
        title: 'Error de Validación',
        description: 'Por favor, ingresa un salario base válido.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const url = '/api/employees';
      const method = isEditMode ? 'PUT' : 'POST';
      const body = {
        id: employee?.id,
        name,
        salary: salaryNumber,
        branch,
        isSupervisor
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'No se pudo guardar el empleado.');
      }

      const savedEmployee = await response.json();
      toast({
        title: 'Éxito',
        description: `El empleado "${savedEmployee.name}" ha sido ${
          isEditMode ? 'actualizado' : 'agregado'
        }.`,
      });
      onSave(savedEmployee);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description:
          (error as Error).message || 'Ocurrió un error inesperado.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? 'Editar Empleado' : 'Agregar Nuevo Empleado'}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? 'Modifica los detalles del empleado.'
                : 'Ingresa los detalles del nuevo empleado. Se agregará como activo por defecto.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nombre
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
                placeholder="Nombre y Apellidos"
                disabled={isSaving}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="branch" className="text-right">
                Sucursal
              </Label>
              <Select
                value={branch}
                onValueChange={setBranch}
                disabled={isSaving || branches.length === 0}
              >
                <SelectTrigger id="branch" className="col-span-3">
                  <SelectValue placeholder={branches.length > 0 ? "Selecciona una sucursal" : "Cargando..."} />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="salary" className="text-right">
                Salario Base
              </Label>
              <Input
                id="salary"
                type="number"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                className="col-span-3"
                placeholder="Ej: 365.00"
                min="0"
                step="0.01"
                disabled={isSaving}
              />
            </div>
            <div className="flex items-center space-x-2 p-4 bg-muted/30 rounded-lg border border-dashed ml-4 mr-0">
                <Checkbox 
                    id="isSupervisor" 
                    checked={isSupervisor} 
                    onCheckedChange={(checked) => setIsSupervisor(!!checked)}
                />
                <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="isSupervisor" className="flex items-center gap-2 cursor-pointer font-bold">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Designar como Jefe/Supervisor
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                        Permite a este empleado autorizar permisos de sus compañeros de sucursal.
                    </p>
                </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
