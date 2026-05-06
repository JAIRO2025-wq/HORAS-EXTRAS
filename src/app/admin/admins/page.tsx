
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
import { Button } from '@/components/ui/button';
import { 
  ShieldCheck, 
  PlusCircle, 
  Loader2, 
  MoreHorizontal, 
  KeyRound, 
  Trash2, 
  Edit 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

type Admin = {
  id: string;
  name: string;
  pin: string;
  role: string;
};

export default function AdminManagementPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsFormOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Partial<Admin> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const fetchAdmins = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/admins');
      if (response.ok) {
        setAdmins(await response.json());
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin?.name || !editingAdmin?.pin) {
        toast({ variant: 'destructive', title: 'Error', description: 'Nombre y PIN son requeridos.' });
        return;
    }

    setIsSaving(true);
    try {
      const method = editingAdmin.id ? 'PUT' : 'POST';
      const response = await fetch('/api/admin/admins', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingAdmin),
      });

      if (response.ok) {
        toast({ title: 'Éxito', description: 'Administrador guardado correctamente.' });
        setIsFormOpen(false);
        fetchAdmins();
      } else {
          const err = await response.json();
          throw new Error(err.error || 'Error al guardar');
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este administrador?')) return;
    try {
      const response = await fetch('/api/admin/admins', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (response.ok) {
        toast({ title: 'Eliminado' });
        fetchAdmins();
      } else {
          const err = await response.json();
          toast({ variant: 'destructive', title: 'Error', description: err.error });
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Gestión de Administradores
          </h1>
          <p className="text-muted-foreground text-sm">Control de acceso al panel administrativo.</p>
        </div>
        <Button onClick={() => { setEditingAdmin({ role: 'ADMIN_1' }); setIsFormOpen(true); }} className="gap-2">
          <PlusCircle className="h-4 w-4" /> Nuevo Admin
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Perfil / Rol</TableHead>
                  <TableHead>PIN</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-bold">{admin.name}</TableCell>
                    <TableCell>
                        <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                            {admin.role === 'ADMIN_1' ? 'Administrador 1 (Control)' : 'Administrador 2 (Gerencia)'}
                        </span>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">****</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => { setEditingAdmin(admin); setIsFormOpen(true); }}>
                            <Edit className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(admin.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingAdmin?.id ? 'Editar Administrador' : 'Nuevo Administrador'}</DialogTitle>
              <DialogDescription>Define los datos de acceso para el personal de administración.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre Completo</Label>
                <Input 
                    id="name" 
                    value={editingAdmin?.name || ''} 
                    onChange={(e) => setEditingAdmin(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Juan Pérez"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Perfil de Sistema</Label>
                <Select 
                    value={editingAdmin?.role} 
                    onValueChange={(v) => setEditingAdmin(prev => ({ ...prev, role: v }))}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Selecciona perfil" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ADMIN_1">Administrador 1 (Control)</SelectItem>
                        <SelectItem value="ADMIN_2">Administrador 2 (Gerencia)</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pin">PIN de Acceso</Label>
                <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="pin" 
                        className="pl-10"
                        value={editingAdmin?.pin || ''} 
                        onChange={(e) => setEditingAdmin(prev => ({ ...prev, pin: e.target.value }))}
                        placeholder="Mínimo 4 dígitos"
                    />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Guardar Administrador
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
