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
import { MoreHorizontal, Loader2, PlusCircle, Search, ShieldCheck } from 'lucide-react';
import type { Employee, Branch } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmployeeDialog } from '@/components/admin/add-employee-dialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const EmployeeActions = ({
  employee,
  onEdit,
  onStatusChange,
}: {
  employee: Employee;
  onEdit: (employee: Employee) => void;
  onStatusChange: (employee: Employee) => void;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleDialogAction = (action: () => void) => {
    action();
    setMenuOpen(false);
  };

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button aria-haspopup="true" size="icon" variant="ghost">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => handleDialogAction(() => onEdit(employee))}>
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onStatusChange(employee)}>
          {employee.status === 'active' ? 'Desactivar' : 'Activar'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};


export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const { toast } = useToast();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');


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
        employeesData.sort((a: Employee, b: Employee) => a.id - b.id)
      );
      setBranches(branchesData.sort((a: Branch, b: Branch) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cargar los datos iniciales.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEmployeeSave = (savedEmployee: Employee) => {
    setEmployees((prev) => {
      const exists = prev.some((e) => e.id === savedEmployee.id);
      let newEmployees;
      if (exists) {
        newEmployees = prev.map((e) =>
          e.id === savedEmployee.id ? savedEmployee : e
        );
      } else {
        newEmployees = [...prev, savedEmployee];
      }
      return newEmployees.sort((a, b) => a.id - b.id);
    });
    setIsAddDialogOpen(false);
    setEditingEmployee(null);
  };

  const handleStatusChange = async (
    employee: Employee
  ) => {
    const newStatus = employee.status === 'active' ? 'inactive' : 'active';
    setUpdatingId(employee.id);
    try {
      const response = await fetch('/api/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: employee.id, status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      const updatedEmployee = await response.json();
      handleEmployeeSave(updatedEmployee);

      toast({
        title: 'Éxito',
        description: `El estado de ${
          employee.name
        } ha sido actualizado a ${
          newStatus === 'active' ? 'Activo' : 'Inactivo'
        }.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description:
          (error as Error).message ||
          'No se pudo actualizar el estado del empleado.',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const filteredEmployees = useMemo(() => {
    return employees
      .filter((employee) => {
        if (branchFilter !== 'all' && employee.branch !== branchFilter) {
          return false;
        }
        if (searchTerm.trim()) {
          const search = searchTerm.trim().toLowerCase();
          return (
            employee.name.toLowerCase().includes(search) ||
            employee.id.toString() === search
          );
        }
        return true;
      });
  }, [employees, searchTerm, branchFilter]);

  return (
    <Card>
       <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
            <div>
                <CardTitle>Gestión de Empleados</CardTitle>
                <CardDescription>
                    Agrega, edita y gestiona los empleados de la empresa.
                </CardDescription>
            </div>
            <div className="flex items-center gap-2 mt-4 sm:mt-0 flex-wrap justify-end">
                <Button
                    size="sm"
                    className="h-9 gap-1"
                    onClick={() => setIsAddDialogOpen(true)}
                >
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>Agregar Empleado</span>
                </Button>
            </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-2">
            <div className="relative w-full sm:flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Buscar por nombre o ID..."
                    className="w-full rounded-lg bg-background pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-[180px]">
                    <SelectValue placeholder="Filtrar por sucursal" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todas las Sucursales</SelectItem>
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
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Salario Base</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                        <TableCell className="font-mono font-bold text-primary">
                          {employee.id}
                        </TableCell>
                        <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                                {employee.name}
                                {employee.isSupervisor && (
                                    <Badge variant="outline" className="h-5 px-1.5 gap-1 bg-primary/5 text-primary border-primary/20">
                                        <ShieldCheck className="h-3 w-3" /> Jefe
                                    </Badge>
                                )}
                            </div>
                        </TableCell>
                        <TableCell>{employee.branch}</TableCell>
                        <TableCell className="font-mono">
                        {formatCurrency(employee.salary)}
                        </TableCell>
                        <TableCell>
                        <Badge
                            variant={
                            employee.status === 'active'
                                ? 'secondary'
                                : 'destructive'
                            }
                        >
                            {employee.status === 'active' ? 'Activo' : 'Inactivo'}
                        </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                        {updatingId === employee.id ? (
                            <div className="flex justify-end px-3">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <EmployeeActions 
                            employee={employee}
                            onEdit={setEditingEmployee}
                            onStatusChange={handleStatusChange}
                            />
                        )}
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                            No se encontraron empleados con los filtros actuales.
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
            <EmployeeDialog
              employee={editingEmployee}
              onSave={handleEmployeeSave}
              isOpen={isAddDialogOpen || !!editingEmployee}
              onOpenChange={(open) => {
                if (!open) {
                  setIsAddDialogOpen(false);
                  setEditingEmployee(null);
                }
              }}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
