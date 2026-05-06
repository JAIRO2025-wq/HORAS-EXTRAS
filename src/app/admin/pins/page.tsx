'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Loader2, KeyRound, RefreshCw, Copy, Check, Search } from 'lucide-react';
import type { Employee, Branch } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { logEvent } from '@/lib/logger';

const PinDialog = ({
  employee,
  isOpen,
  onOpenChange,
  onPinSaved,
}: {
  employee: Employee | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPinSaved: (employee: Employee) => void;
}) => {
  const [pin, setPin] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (employee) {
      setPin(employee.pin || '');
    }
  }, [employee]);

  const generateRandomPin = () => {
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    setPin(randomPin);
  };

  const handleSave = async () => {
    if (!employee) return;
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      toast({
        variant: 'destructive',
        title: 'PIN Inválido',
        description: 'El PIN debe ser exactamente 6 dígitos numéricos.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: employee.id, pin: pin }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'No se pudo actualizar el PIN.');
      }
      const updatedEmployee = await response.json();
      
      logEvent({
        eventType: 'employee_updated',
        message: `El Administrador cambió el PIN de '${employee.name}'.`,
      });

      onPinSaved(updatedEmployee);
      toast({
        title: 'Éxito',
        description: `El PIN para ${employee.name} ha sido actualizado.`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: (error as Error).message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar PIN para {employee?.name}</DialogTitle>
          <DialogDescription>
            Puedes generar un PIN aleatorio o ingresar uno nuevo manualmente. El PIN debe contener 6 dígitos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="pin">PIN de 6 dígitos</Label>
            <div className="flex gap-2">
              <Input
                id="pin"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={6}
                placeholder="******"
                className="font-mono text-lg tracking-widest"
              />
              <Button variant="outline" size="icon" onClick={generateRandomPin}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function AdminPinsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const { toast } = useToast();

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [employeesResponse, branchesResponse] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/branches'),
      ]);
      if (!employeesResponse.ok) throw new Error('Failed to fetch employees');
      if (!branchesResponse.ok) throw new Error('Failed to fetch branches');
      
      const employeesData = await employeesResponse.json();
      const branchesData = await branchesResponse.json();

      setEmployees(
        employeesData.sort((a: Employee, b: Employee) => a.name.localeCompare(b.name))
      );
      setBranches(branchesData.sort((a: Branch, b: Branch) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cargar la lista de empleados y sucursales.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesBranch = branchFilter === 'all' || employee.branch === branchFilter;
      return matchesSearch && matchesBranch;
    });
  }, [employees, searchTerm, branchFilter]);

  const handleOpenPinDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsPinDialogOpen(true);
  };
  
  const handlePinSaved = (updatedEmployee: Employee) => {
    setEmployees(prev =>
        prev.map(emp => (emp.id === updatedEmployee.id ? updatedEmployee : emp))
    );
  };

  const copyCredentials = (employee: Employee) => {
    const text = `Empleado: ${employee.name} | Sucursal: ${employee.branch} | PIN: ${employee.pin || 'NO ASIGNADO'}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(employee.id);
      toast({
        title: 'Copiado',
        description: 'Credenciales copiadas al portapapeles.',
      });
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Gestión de PINs de Empleados</CardTitle>
              <CardDescription>
                Administra los PINs de seguridad de 6 dígitos para el inicio de sesión de los empleados.
              </CardDescription>
            </div>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empleado por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Todas las sucursales" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sucursales</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.name}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre del Empleado</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>PIN Actual</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>{employee.branch}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm tracking-widest">
                            {employee.pin || 'NO ASIGNADO'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => copyCredentials(employee)}
                          title="Copiar credenciales"
                        >
                          {copiedId === employee.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenPinDialog(employee)}
                        >
                          Cambiar PIN
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No se encontraron empleados con los filtros aplicados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <PinDialog 
        employee={selectedEmployee}
        isOpen={isPinDialogOpen}
        onOpenChange={setIsPinDialogOpen}
        onPinSaved={handlePinSaved}
      />
    </>
  );
}
