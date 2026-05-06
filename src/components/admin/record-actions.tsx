'use client';

import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  MoreHorizontal,
  CheckCircle,
  XCircle,
  FileClock,
  CalendarPlus,
} from 'lucide-react';
import type { OvertimeRecord } from '@/lib/types';

type OvertimeRecordWithEmployee = OvertimeRecord & { employeeName: string };

type RecordActionsProps = {
  record: OvertimeRecordWithEmployee;
  onUpdate: (
    record: OvertimeRecordWithEmployee,
    updates: Partial<OvertimeRecord>
  ) => void;
  onEdit: (record: OvertimeRecordWithEmployee) => void;
  onDelete: (record: OvertimeRecordWithEmployee) => void;
};

export function RecordActions({
  record,
  onUpdate,
  onEdit,
  onDelete,
}: RecordActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  // This helper ensures the parent action (which opens a dialog) is called,
  // and then we explicitly close the menu to avoid focus conflicts.
  const handleDialogAction = (action: () => void) => {
    action();
    setMenuOpen(false);
  };

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button aria-haspopup="true" size="icon" variant="ghost">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Abrir menú</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onUpdate(record, { status: 'approved' })}>
          <CheckCircle className="mr-2 h-4 w-4" />
          Aprobar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onUpdate(record, { status: 'rejected' })}>
          <XCircle className="mr-2 h-4 w-4" />
          Rechazar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onUpdate(record, { type: 'additional_day' })}>
          <CalendarPlus className="mr-2 h-4 w-4" />
          Marcar como Día Adicional
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onUpdate(record, { type: 'overtime' })}>
          <FileClock className="mr-2 h-4 w-4" />
          Marcar como Horas Extra
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            console.log('DEBUG (from RecordActions): "Editar" seleccionado. Cerrando menú y abriendo diálogo.');
            handleDialogAction(() => onEdit(record));
          }}
        >
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
             console.log('DEBUG (from RecordActions): "Eliminar" seleccionado. Cerrando menú y abriendo diálogo.');
            handleDialogAction(() => onDelete(record));
          }}
          className="text-red-600"
        >
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
