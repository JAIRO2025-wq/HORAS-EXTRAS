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
import { Loader2, Laptop, ShieldOff, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import type { Branch } from '@/lib/types';

export default function AdminDevicesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingBranch, setRevokingBranch] = useState<Branch | null>(null);
  const { toast } = useToast();

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

  const handleRevoke = async () => {
    if (!revokingBranch) return;

    try {
      const response = await fetch('/api/branches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: revokingBranch.id, deviceId: null }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'No se pudo revocar el dispositivo.');
      }

      toast({
        title: 'Éxito',
        description: `El dispositivo de confianza para "${revokingBranch.name}" ha sido revocado.`
      });
      fetchBranches(); // Refetch to update the list
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: (error as Error).message
      })
    } finally {
        setRevokingBranch(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Dispositivos</CardTitle>
          <CardDescription>
            Administra qué dispositivo está autorizado para registrar horas en cada sucursal. Solo un dispositivo puede estar activo por sucursal.
          </CardDescription>
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
                  <TableHead>Estado del Dispositivo</TableHead>
                  <TableHead>ID del Dispositivo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">{branch.name}</TableCell>
                    <TableCell>
                        {branch.deviceId ? (
                            <Badge variant="secondary" className="flex gap-2 items-center w-fit">
                                <Laptop className="h-3.5 w-3.5"/> Autorizado
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="flex gap-2 items-center w-fit">
                               <ShieldOff className="h-3.5 w-3.5"/> No Autorizado
                            </Badge>
                        )}
                    </TableCell>
                    <TableCell>
                        {branch.deviceId ? (
                             <div className="flex items-center gap-2">
                                <KeyRound className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono text-xs text-muted-foreground truncate">{branch.deviceId}</span>
                            </div>
                        ) : (
                            <span className="text-muted-foreground">N/A</span>
                        )}
                    </TableCell>
                    <TableCell className="text-right">
                       <Button 
                            variant="destructive" 
                            size="sm"
                            disabled={!branch.deviceId}
                            onClick={() => setRevokingBranch(branch)}
                        >
                          Revocar
                       </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10">
                <Laptop className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium">No hay sucursales creadas</h3>
                <p className="mt-1 text-sm text-muted-foreground">Agrega una sucursal para poder gestionar sus dispositivos.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!revokingBranch} onOpenChange={(open) => !open && setRevokingBranch(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro de revocar este dispositivo?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta acción no se puede deshacer. El dispositivo actual ya no podrá registrar horas para la sucursal <strong>{revokingBranch?.name}</strong>. 
                    El próximo inicio de sesión desde cualquier máquina para esta sucursal requerirá una nueva autorización.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleRevoke}>Sí, revocar</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
