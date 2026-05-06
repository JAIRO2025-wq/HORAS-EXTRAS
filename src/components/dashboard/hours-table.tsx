import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { OvertimeRecord } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Hourglass } from 'lucide-react';
import { Badge } from '@/components/ui/badge';


interface HoursTableProps {
  records: OvertimeRecord[];
}

export function HoursTable({ records }: HoursTableProps) {
  if (records.length === 0) {
    return (
      <Card className="mt-4">
        <CardContent className="p-6 text-center">
           <Hourglass className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No hay Horas Extra Registradas</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Comienza agregando un nuevo registro de horas extra.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Registros de Horas Extra</CardTitle>
        <CardDescription>Una lista de tus horas extra registradas para este período.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead className="hidden sm:table-cell">Horario</TableHead>
              <TableHead className="text-right">Horas Totales</TableHead>
              <TableHead className="hidden md:table-cell text-right">Día/Noche</TableHead>
              <TableHead className="hidden lg:table-cell">Actividad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-medium">{format(record.date, "dd 'de' MMMM, yyyy", { locale: es })}</TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">
                  {record.startTime} - {record.endTime}
                </TableCell>
                <TableCell className="text-right font-mono">{(record.totalHours ?? 0).toFixed(2)}</TableCell>
                <TableCell className="hidden md:table-cell text-right">
                  <div className="flex flex-col items-end">
                    <Badge variant="outline">Diurnas: {(record.dayHours ?? 0).toFixed(2)}</Badge>
                    <Badge variant="secondary" className="mt-1">Nocturnas: {(record.nightHours ?? 0).toFixed(2)}</Badge>
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell max-w-[200px] truncate">{record.activity}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
