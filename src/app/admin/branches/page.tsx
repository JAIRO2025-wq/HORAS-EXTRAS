'use client';

import { useState, useEffect } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, PlusCircle, Building, Loader2, Lock, Unlock, Clock, Clock9 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BranchDialog } from '@/components/admin/branch-dialog';
import type { Branch } from '@/lib/types';
import { Badge } from '@/components/ui/badge';


// New sub-component to manage its own state and fix the focus trap issue.
const BranchActions = ({
  branch,
  onEdit,
  onDelete,
}: {
  branch: Branch;
  onEdit: (branch: Branch) => void;
  onDelete: (branch: Branch) => void;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleDialogAction = (action: () => void) => {
    action();
    setMenuOpen(false); // Explicitly close the menu
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
        <DropdownMenuItem onSelect={() => handleDialogAction(() => onEdit(branch))}>
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleDialogAction(() => onDelete(branch))} className="text-red-600">
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};


export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [editingBranch, setEditingBranch] = useState<Partial<Branch> | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const fetchBranches = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/branches');
      if (!response.ok) throw new Error('Failed to fetch branches');
      const data = await response.json();
      setBranches(data.sort((a: Branch, b: Branch) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cargar la lista de sucursales.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenDialog = (branch?: Branch) => {
    setEditingBranch(branch || {});
    setIsFormOpen(true);
  };

  const handleSave = (savedBranch: Branch) => {
    setBranches(prev => {
        const exists = prev.some(b => b.id === savedBranch.id);
        let newBranches;
        if (exists) {
            newBranches = prev.map(b => b.id === savedBranch.id ? savedBranch : b);
        } else {
            newBranches = [...prev, savedBranch];
        }
        return newBranches.sort((a,b) => a.name.localeCompare(b.name));
    });
    setIsFormOpen(false);
    setEditingBranch(null);
  }

  const handleDelete = async () => {
    if (!deletingBranch) return;

    try {
      const response = await fetch('/api/branches', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingBranch.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'No se pudo eliminar la sucursal.');
      }

      setBranches(prev => prev.filter(b => b.id !== deletingBranch.id));
      toast({
        title: 'Éxito',
        description: `La sucursal "${deletingBranch.name}" ha sido eliminada.`
      });

    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: (error as Error).message
      })
    } finally {
        setDeletingBranch(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center">
          <div className="grid gap-2">
            <CardTitle>Gestión de Sucursales</CardTitle>
            <CardDescription>Agrega, edita y elimina las sucursales de la empresa.</CardDescription>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" className="h-8 gap-1" onClick={() => handleOpenDialog()}>
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Agregar Sucursal</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : branches.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre de la Sucursal</TableHead>
                  <TableHead>Tipo de Acceso</TableHead>
                  <TableHead>Asistencia</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">{branch.name}</TableCell>
                    <TableCell>
                      <Badge variant={branch.isUnrestricted ? 'secondary' : 'outline'}>
                         {branch.isUnrestricted ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                         {branch.isUnrestricted ? 'Libre' : 'Restringido'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                        {branch.isAttendanceEnabled ? (
                            <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                                <Clock className="h-3 w-3" /> Habilitada
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="gap-1 opacity-60">
                                <Clock9 className="h-3 w-3" /> Deshabilitada
                            </Badge>
                        )}
                    </TableCell>
                    <TableCell className="text-right">
                       <BranchActions 
                            branch={branch}
                            onEdit={handleOpenDialog}
                            onDelete={setDeletingBranch}
                       />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10">
                <Building className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium">No hay sucursales creadas</h3>
                <p className="mt-1 text-sm text-muted-foreground">Comienza agregando tu primera sucursal.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <BranchDialog 
        branch={editingBranch}
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={handleSave}
      />

      <AlertDialog open={!!deletingBranch} onOpenChange={(open) => !open && setDeletingBranch(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará la sucursal permanentemente. Asegúrate de que no haya empleados asignados a esta sucursal.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
