'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  Calendar, 
  Building, 
  Clock, 
  LogIn, 
  LogOut, 
  Search, 
  FileDown 
} from 'lucide-react';
import type { AttendanceRecord, Branch, Employee } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';

type AttendanceDay = {
  employeeId: string;
  employeeName: string;
  branch: string;
  date: string;
  entryTime: string | null;
  exitTime: string | null;
  entryFull: string | null;
  exitFull: string | null;
};

export default function AdminAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [month, setMonth] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const storedAdmin = localStorage.getItem('overtimeAdmin');
    if (storedAdmin) {
      const parsed = JSON.parse(storedAdmin);
      setMonth(parsed.month);
    }
  }, []);

  useEffect(() => {
    if (!month) return;

    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        const [attRes, branchRes, empRes] = await Promise.all([
          fetch(`/api/admin/attendance?month=${encodeURIComponent(month)}`),
          fetch('/api/branches'),
          fetch('/api/employees')
        ]);
        
        const attData = await attRes.json();
        const branchData = await branchRes.json();
        const empData = await empRes.json();
        
        setRecords(attData);
        setBranches(branchData);
        setEmployees(empData);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [month]);

  const groupedRecords = useMemo(() => {
    const days: Record<string, AttendanceDay> = {};

    records.forEach((rec) => {
      const dayKey = `${rec.employeeName}-${rec.date}`;
      if (!days[dayKey]) {
        // Buscar el ID si no viene en el registro
        let displayId = rec.employeeId?.toString();
        if (!displayId || displayId === 'undefined') {
          const emp = employees.find(e => e.name === rec.employeeName);
          if (emp) displayId = emp.id.toString();
        }

        days[dayKey] = {
          employeeId: displayId || 'N/A',
          employeeName: rec.employeeName,
          branch: rec.branch,
          date: rec.date,
          entryTime: null,
          exitTime: null,
          entryFull: null,
          exitFull: null,
        };
      }

      const timestamp = parseISO(rec.timestamp);
      const timeStr = format(timestamp, 'HH:mm:ss');

      if (rec.type === 'in') {
        if (!days[dayKey].entryTime || timestamp < parseISO(days[dayKey].entryFull!)) {
          days[dayKey].entryTime = timeStr;
          days[dayKey].entryFull = rec.timestamp;
        }
      } else {
        if (!days[dayKey].exitTime || timestamp > parseISO(days[dayKey].exitFull!)) {
          days[dayKey].exitTime = timeStr;
          days[dayKey].exitFull = rec.timestamp;
        }
      }
    });

    let result = Object.values(days);
    
    if (branchFilter !== 'all') {
      result = result.filter(r => r.branch === branchFilter);
    }

    if (searchTerm.trim() !== '') {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(r => 
        r.employeeName.toLowerCase().includes(lowerSearch) || 
        r.employeeId.toLowerCase().includes(lowerSearch)
      );
    }

    return result.sort((a, b) => b.date.localeCompare(a.date) || a.employeeName.localeCompare(b.employeeName));
  }, [records, branchFilter, searchTerm, employees]);

  const handleExport = useCallback(() => {
    if (groupedRecords.length === 0) return;
    setIsExporting(true);

    try {
      const dataToExport = groupedRecords.map(rec => ({
        'ID Empleado': rec.employeeId,
        'Nombre': rec.employeeName,
        'Sucursal': rec.branch,
        'Fecha': format(parseISO(rec.date), 'dd/MM/yyyy'),
        'Hora Entrada': rec.entryTime || 'Sin marca',
        'Hora Salida': rec.exitTime || 'Pendiente'
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      
      worksheet['!cols'] = [
        { wch: 15 }, 
        { wch: 30 }, 
        { wch: 20 }, 
        { wch: 15 }, 
        { wch: 15 }, 
        { wch: 15 }
      ];

      const workbook = XLSX.utils.book_new();
      const sheetName = `Asistencia_${month}`.replace(/ /g, '_');
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      
      XLSX.writeFile(workbook, `Reporte_Asistencia_${month}_${new Date().getTime()}.xlsx`);

      toast({
        title: 'Exportación Exitosa',
        description: 'El reporte de asistencia ha sido generado.'
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error al exportar',
        description: 'No se pudo generar el archivo Excel.'
      });
    } finally {
      setIsExporting(false);
    }
  }, [groupedRecords, month, toast]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Control de Asistencia por Jornada</CardTitle>
              <CardDescription>Resumen de entradas y salidas diarias para {month}.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar empleado o ID..."
                  className="pl-8 w-full sm:w-[250px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger className="w-[180px]">
                      <div className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          <SelectValue placeholder="Sucursal" />
                      </div>
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="all">Todas las Sucursales</SelectItem>
                      {branches.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                  </SelectContent>
              </Select>
              <Button 
                onClick={handleExport} 
                disabled={groupedRecords.length === 0 || isExporting}
                className="gap-2 bg-green-600 hover:bg-green-700 text-white border-none"
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                Exportar Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : groupedRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">ID</TableHead>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Sucursal</TableHead>
                    <TableHead>Día</TableHead>
                    <TableHead className="text-center">Hora Entrada</TableHead>
                    <TableHead className="text-center">Hora Salida</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedRecords.map((rec, idx) => (
                    <TableRow key={`${rec.employeeName}-${rec.date}-${idx}`}>
                      <TableCell className="font-mono font-bold text-primary">{rec.employeeId}</TableCell>
                      <TableCell className="font-medium">{rec.employeeName}</TableCell>
                      <TableCell>{rec.branch}</TableCell>
                      <TableCell>{format(parseISO(rec.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-center">
                          {rec.entryTime ? (
                            <Badge variant="secondary" className="font-mono gap-1.5 bg-green-50 text-green-700 hover:bg-green-50 border-green-100">
                                <LogIn className="h-3 w-3" /> {rec.entryTime}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">Sin marca</span>
                          )}
                      </TableCell>
                      <TableCell className="text-center">
                          {rec.exitTime ? (
                             <Badge variant="outline" className="font-mono gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-100">
                                <LogOut className="h-3 w-3" /> {rec.exitTime}
                             </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 opacity-50 border-dashed">
                                <Clock className="h-3 w-3" /> Pendiente
                            </Badge>
                          )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No se encontraron registros de asistencia con los filtros seleccionados.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
