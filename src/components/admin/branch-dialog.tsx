'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import React, { useEffect } from 'react';
import type { Branch } from '@/lib/types';

const FormSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido.'),
  isUnrestricted: z.boolean().default(false),
  isAttendanceEnabled: z.boolean().default(false),
});

type BranchDialogProps = {
  branch: Partial<Branch> | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (branch: Branch) => void;
};

export function BranchDialog({ branch, isOpen, onOpenChange, onSave }: BranchDialogProps) {
  const { toast } = useToast();
  const isEditMode = !!branch?.id;

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
      isUnrestricted: false,
      isAttendanceEnabled: false,
    }
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        name: branch?.name || '',
        isUnrestricted: branch?.isUnrestricted || false,
        isAttendanceEnabled: branch?.isAttendanceEnabled || false,
      });
    }
  }, [branch, isOpen, form]);

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    try {
      const url = '/api/branches';
      const method = isEditMode ? 'PUT' : 'POST';
      const body = isEditMode
        ? { 
            id: branch!.id, 
            name: data.name, 
            isUnrestricted: data.isUnrestricted,
            isAttendanceEnabled: data.isAttendanceEnabled 
          }
        : { 
            name: data.name, 
            isUnrestricted: data.isUnrestricted,
            isAttendanceEnabled: data.isAttendanceEnabled 
          };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'No se pudo guardar la sucursal.');
      }

      const savedBranch = await response.json();
      toast({
        title: 'Éxito',
        description: `La sucursal "${savedBranch.name}" ha sido ${
          isEditMode ? 'actualizada' : 'agregada'
        }.`,
      });
      onSave(savedBranch);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: (error as Error).message || 'Ocurrió un error inesperado.',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Editar Sucursal' : 'Agregar Nueva Sucursal'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Modifica los detalles de la sucursal.' : 'Ingresa los detalles de la nueva sucursal.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la Sucursal</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Sucursal Centro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="isUnrestricted"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Acceso Libre</FormLabel>
                    <DialogDescription className="text-xs">
                      Si se activa, cualquier dispositivo podrá iniciar sesión para esta sucursal.
                    </DialogDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isAttendanceEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Habilitar Control de Asistencia</FormLabel>
                    <DialogDescription className="text-xs">
                      Si se activa, los empleados verán el Reloj Marcador para sus entradas y salidas.
                    </DialogDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
