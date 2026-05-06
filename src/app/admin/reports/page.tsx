'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
import type { OvertimeRecord, Employee, Branch } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Hourglass,
  FileDown,
  Loader2,
  PlusCircle,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RecordDialog } from '@/components/admin/record-dialog';
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
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { RecordActions } from '@/components/admin/record-actions';
import { cn, getOvertimeHoursFromRecord } from '@/lib/utils';

type OvertimeRecordWithEmployee = OvertimeRecord & { employeeName: string };

const ITEMS_PER_PAGE = 10;

const getBadgeVariant = (status: OvertimeRecord['status']) => {
  switch (status) {
      case 'approved': return 'secondary';
      case 'rejected': return 'destructive';
      case 'pending':
      default:
          return 'outline';
  }
};

const translateStatus = (status: OvertimeRecord['status']): string => {
  switch (status) {
    case 'approved': return 'Aprobado';
    case 'rejected': return 'Rechazado';
    case 'pending': return 'Pendiente';
    default: return status;
  }
};

export default function AdminReportsPage() {
  const [records, setRecords] = useState<OvertimeRecordWithEmployee[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [month, setMonth] = useState<string | null>(null);
  
  // Filtros
  const [quincenaFilter, setQuincenaFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);

  const { toast } = useToast();

  const [editingRecord, setEditingRecord] = useState<Partial<OvertimeRecordWithEmployee> | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<OvertimeRecordWithEmployee | null>(null);
  
  const fetchAllData = useCallback(async (currentMonth: string) => {
    setIsLoading(true);
    try {
      const [recordsResponse, employeesResponse, branchesResponse] = await Promise.all([
        fetch(`/api/admin/all-records?month=${encodeURIComponent(currentMonth)}`),
        fetch('/api/employees'),
        fetch('/api/branches'),
      ]);

      if (!recordsResponse.ok) throw new Error('Failed to fetch records');
      if (!employeesResponse.ok) throw new Error('Failed to fetch employees');
      if (!branchesResponse.ok) throw new Error('Failed to fetch branches');

      const recordsData = await recordsResponse.json();
      const employeesData = await employeesResponse.json();
      const branchesData = await branchesResponse.json();
      
      const parsedRecords = recordsData.map((rec: any) => ({
        ...rec,
        date: new Date(rec.date),
        status: rec.status || 'pending',
        type: rec.type || 'overtime',
      }));

      setRecords(parsedRecords);
      setEmployees(employeesData.filter((e: Employee) => e.status === 'active'));
      setBranches(branchesData);
    } catch (error) {
      console.error('Error fetching data:', error);
      setRecords([]);
      setEmployees([]);
      setBranches([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedAdmin = localStorage.getItem('overtimeAdmin');
    if (storedAdmin) {
      const parsedAdmin = JSON.parse(storedAdmin);
      setMonth(parsedAdmin.month);
      if (parsedAdmin.month) {
        fetchAllData(parsedAdmin.month);
      }
    }
  }, [fetchAllData]);

  const handleSaveRecord = (savedRecord: OvertimeRecord) => {
    setRecords((prev) => {
      const exists = prev.some((r) => r.id === savedRecord.id);
      if (exists) {
        return prev
          .map((r) => (r.id === savedRecord.id ? (savedRecord as OvertimeRecordWithEmployee) : r))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
      return [...prev, savedRecord as OvertimeRecordWithEmployee].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    });
  };

  const handleUpdateRecord = async (record: OvertimeRecordWithEmployee, updates: Partial<OvertimeRecord>) => {
    try {
        const response = await fetch('/api/admin/records', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeName: record.employeeName,
                month,
                record: { ...record, ...updates },
            })
        });
        if (!response.ok) throw new Error('Failed to update record');
        const updatedRecord = await response.json();
        handleSaveRecord({ 
          ...updatedRecord, 
          date: new Date(updatedRecord.date), 
          employeeName: record.employeeName 
        });
        toast({ title: 'Éxito', description: 'El registro ha sido actualizado.' });
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
    }
  };
  
  const handleDeleteRecord = async () => {
    if (!recordToDelete || !month) return;
    try {
        const response = await fetch('/api/admin/records', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeName: recordToDelete.employeeName,
                month,
                recordId: recordToDelete.id
            })
        });
        if (!response.ok) throw new Error('Failed to delete record');
        setRecords(prev => prev.filter(r => r.id !== recordToDelete.id));
        toast({ title: 'Éxito', description: 'El registro ha sido eliminado.' });
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
    } finally {
        setRecordToDelete(null);
    }
  }

  const filteredRecords = useMemo(() => {
    let tempRecords = records;
    
    if (branchFilter !== 'all') {
        const employeesInBranch = employees.filter(e => e.branch === branchFilter).map(e => e.name);
        tempRecords = tempRecords.filter(rec => employeesInBranch.includes(rec.employeeName));
    }

    if (quincenaFilter !== 'all') {
        tempRecords = tempRecords.filter(rec => rec.quincena.toString() === quincenaFilter);
    }

    if (statusFilter !== 'all') {
        tempRecords = tempRecords.filter(rec => rec.status === statusFilter);
    }

    if (typeFilter !== 'all') {
        tempRecords = tempRecords.filter(rec => rec.type === typeFilter);
    }

    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      tempRecords = tempRecords.filter(rec => 
        rec.employeeName.toLowerCase().includes(lowerSearch) || 
        (rec.coworkers && rec.coworkers.toLowerCase().includes(lowerSearch)) ||
        (rec.activity && rec.activity.toLowerCase().includes(lowerSearch))
      );
    }

    return tempRecords;
  }, [records, quincenaFilter, branchFilter, employees, searchTerm, statusFilter, typeFilter]);

  // PAGINACIÓN
  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, branchFilter, quincenaFilter, statusFilter, typeFilter]);

  const handleExport = useCallback(async () => {
    if (filteredRecords.length === 0) return;
    setIsExporting(true);

    const workbook = new ExcelJS.Workbook();
    const blueHeader = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0070C0' }
    };
    const greenFill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFC6EFCE' }
    };
    const whiteBold = { color: { argb: 'FFFFFFFF' }, bold: true };

    // --- HOJA 1: LISTA GENERAL ---
    const sheet1 = workbook.addWorksheet('Lista General');
    sheet1.addRow(['BITACORA GENERAL DE HORAS EXTRA - ' + month]);
    sheet1.getCell('A1').font = { size: 16, bold: true };
    sheet1.addRow([]);

    const headers1 = ['Empleado', 'Fecha', 'Horario', 'Actividad', 'Compañeros', 'H. Totales', 'H. Diurnas', 'H. Nocturnas', 'Quincena', 'Tipo', 'Estado', 'Fecha Registro'];
    const hr1 = sheet1.addRow(headers1);
    hr1.eachCell(c => { c.fill = blueHeader; c.font = whiteBold; });
    sheet1.views = [{ state: 'frozen', xSplit: 0, ySplit: 3, activePane: 'bottomLeft' }];

    filteredRecords.forEach(r => {
        const row = sheet1.addRow([
            r.employeeName,
            format(r.date, 'yyyy-MM-dd'),
            `${r.startTime} - ${r.endTime}`,
            r.activity,
            r.coworkers,
            parseFloat((r.totalHours || 0).toFixed(2)),
            parseFloat((r.dayHours || 0).toFixed(2)),
            parseFloat((r.nightHours || 0).toFixed(2)),
            r.quincena,
            r.type === 'additional_day' ? 'Día Adicional' : 'Horas Extra',
            translateStatus(r.status),
            r.createdAt ? format(parseISO(r.createdAt), 'dd/MM/yyyy HH:mm:ss') : '-'
        ]);
        row.getCell(7).fill = greenFill;
        row.getCell(8).fill = greenFill;
    });
    sheet1.columns = [{ width: 25 }, { width: 12 }, { width: 20 }, { width: 40 }, { width: 25 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 15 }, { width: 12 }, { width: 20 }];

    // --- HOJA 2: DESGLOSE POR EMPLEADO ---
    const sheet2 = workbook.addWorksheet('Desglose por Empleado');
    sheet2.addRow(['RESUMEN ACUMULADO POR COLABORADOR - ' + month]);
    sheet2.getCell('A1').font = { size: 16, bold: true };
    sheet2.addRow([]);

    const headers2 = ['Empleado', 'Fecha', 'Horario', 'Actividad', 'H. Diurnas', 'H. Nocturnas', 'H. Totales', 'Tipo', 'Estado', 'Fecha Registro'];
    const hr2 = sheet2.addRow(headers2);
    hr2.eachCell(c => { c.fill = blueHeader; c.font = whiteBold; });

    const sorted = [...filteredRecords].sort((a, b) => a.employeeName.localeCompare(b.employeeName) || a.date.getTime() - b.date.getTime());
    
    let currentEmp = "";
    let empTotals = { day: 0, night: 0, total: 0 };

    sorted.forEach((r, idx) => {
        if (currentEmp !== "" && currentEmp !== r.employeeName) {
            const subRow = sheet2.addRow([
              `SUBTOTAL ${currentEmp}`, '', '', '--- ACUMULADO ---', 
              parseFloat(empTotals.day.toFixed(2)), 
              parseFloat(empTotals.night.toFixed(2)), 
              parseFloat(empTotals.total.toFixed(2)), 
              '', '', ''
            ]);
            subRow.eachCell(c => c.font = { bold: true });
            sheet2.addRow([]);
            empTotals = { day: 0, night: 0, total: 0 };
        }

        sheet2.addRow([
            r.employeeName,
            format(r.date, 'yyyy-MM-dd'),
            `${r.startTime} - ${r.endTime}`,
            r.activity,
            parseFloat((r.dayHours || 0).toFixed(2)),
            parseFloat((r.nightHours || 0).toFixed(2)),
            parseFloat((r.totalHours || 0).toFixed(2)),
            r.type === 'additional_day' ? 'Día Adic.' : 'Horas Extra',
            translateStatus(r.status),
            r.createdAt ? format(parseISO(r.createdAt), 'dd/MM/yy HH:mm') : '-'
        ]);

        currentEmp = r.employeeName;
        empTotals.day += (r.dayHours || 0);
        empTotals.night += (r.nightHours || 0);
        empTotals.total += (r.totalHours || 0);

        if (idx === sorted.length - 1) {
            const subRow = sheet2.addRow([
              `SUBTOTAL ${currentEmp}`, '', '', '--- ACUMULADO ---', 
              parseFloat(empTotals.day.toFixed(2)), 
              parseFloat(empTotals.night.toFixed(2)), 
              parseFloat(empTotals.total.toFixed(2)), 
              '', '', ''
            ]);
            subRow.eachCell(c => c.font = { bold: true });
        }
    });

    sheet2.columns = [{ width: 25 }, { width: 12 }, { width: 20 }, { width: 40 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 15 }, { width: 12 }, { width: 18 }];

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Reporte_Bitacora_${month}_${new Date().getTime()}.xlsx`);
    setIsExporting(false);
  }, [filteredRecords, month]);

  const renderLoading = () => (
    <div className="space-y-2">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );

  const renderEmpty = () => (
    <CardContent className="p-6 text-center">
      <Hourglass className="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-medium">No hay registros para este período</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Los empleados aún no han registrado horas extra o puedes agregar un registro tú mismo.
      </p>
    </CardContent>
  );

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Reporte de Horas Extra</CardTitle>
              <CardDescription>
                Bitácora completa para {month || '...'}.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-9 gap-1" onClick={() => setEditingRecord({})}>
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>Agregar</span>
                </Button>
                <Button 
                    size="sm" 
                    className="h-9 gap-1 bg-green-600 hover:bg-green-700 text-white border-none shadow-sm" 
                    onClick={handleExport} 
                    disabled={isExporting || filteredRecords.length === 0}
                >
                    {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                    <span>Exportar Excel</span>
                </Button>
            </div>
        </div>
        
        <div className="flex flex-wrap gap-3 mt-6 p-4 bg-muted/30 rounded-xl border border-dashed items-center">
            <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Empleado, compañeros o actividad..."
                    className="pl-8 h-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Sucursal" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todas las Sucursales</SelectItem>
                    {branches.map(branch => (
                        <SelectItem key={branch.id} value={branch.name}>{branch.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select value={quincenaFilter} onValueChange={setQuincenaFilter}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Quincena" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Cualquier Q</SelectItem>
                    <SelectItem value="1">1ra Quincena</SelectItem>
                    <SelectItem value="2">2da Quincena</SelectItem>
                </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] h-9">
                    <div className="flex items-center gap-2"><Filter className="h-3 w-3" /><SelectValue placeholder="Estado" /></div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Cualquier Estado</SelectItem>
                    <SelectItem value="pending">Pendientes</SelectItem>
                    <SelectItem value="approved">Aprobados</SelectItem>
                    <SelectItem value="rejected">Rechazados</SelectItem>
                </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px] h-9">
                    <div className="flex items-center gap-2"><Filter className="h-3 w-3" /><SelectValue placeholder="Tipo" /></div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Cualquier Tipo</SelectItem>
                    <SelectItem value="overtime">Horas Extra</SelectItem>
                    <SelectItem value="additional_day">Día Adicional</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading
          ? renderLoading()
          : filteredRecords.length === 0
          ? renderEmpty()
          : (
            <>
            <div className="overflow-auto rounded-md border">
                <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                    <TableHead className="py-2">Empleado</TableHead>
                    <TableHead className="py-2">Fecha Lab.</TableHead>
                    <TableHead className="py-2">Horario</TableHead>
                    <TableHead className="text-right py-2">Horas</TableHead>
                    <TableHead className="py-2">Actividad Realizada</TableHead>
                    <TableHead className="py-2">F. Registro</TableHead>
                    <TableHead className="py-2">Tipo</TableHead>
                    <TableHead className="py-2">Estado</TableHead>
                    <TableHead className="py-2"><span className="sr-only">Acciones</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {paginatedRecords.map((record) => {
                      const laborDateStr = format(record.date, 'yyyy-MM-dd');
                      const regDate = record.createdAt ? parseISO(record.createdAt) : null;
                      const regDateStr = regDate ? format(regDate, 'yyyy-MM-dd') : null;
                      const isDelayed = regDateStr && regDateStr !== laborDateStr;
                      const isSameDay = regDateStr && regDateStr === laborDateStr;

                      return (
                        <TableRow key={record.id} className="even:bg-muted/10 hover:bg-muted/30 transition-colors">
                            <TableCell className="font-medium py-1">{record.employeeName}</TableCell>
                            <TableCell className="whitespace-nowrap py-1">
                              <span className="text-[11px] font-bold">
                                {format(record.date, "eeee dd/MM/yy", { locale: es }).toLowerCase()}
                              </span>
                            </TableCell>
                            <TableCell className="font-mono text-[10px] whitespace-nowrap py-1 text-muted-foreground">{record.startTime} - {record.endTime}</TableCell>
                            <TableCell className="text-right font-mono font-semibold py-1">{(record.totalHours ?? 0).toFixed(2)}</TableCell>
                            <TableCell className="py-1 min-w-[200px]">
                              <div className="flex items-start gap-2 max-w-[300px]">
                                <FileText className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                                <span className="text-[11px] text-zinc-600 line-clamp-2 leading-tight">
                                  {record.activity}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className={cn("py-1 transition-colors", isSameDay && "bg-green-50/50", isDelayed && "bg-red-50/50")}>
                              <div className={cn(
                                "flex items-center gap-1.5 text-[10px] font-bold whitespace-nowrap px-2 py-0.5 rounded",
                                isSameDay ? "text-green-700" : isDelayed ? "text-red-700" : "text-zinc-500"
                              )}>
                                <Clock className="h-3 w-3" />
                                {record.createdAt ? format(parseISO(record.createdAt), "dd/MM/yy HH:mm") : '-'}
                              </div>
                            </TableCell>
                            <TableCell className="py-1"><Badge variant={record.type === 'additional_day' ? 'default' : 'outline'} className="text-[9px] uppercase h-5">{record.type === 'additional_day' ? 'Día Adic.' : 'Horas Extra'}</Badge></TableCell>
                            <TableCell className="py-1"><Badge variant={getBadgeVariant(record.status)} className="text-[9px] h-5">{translateStatus(record.status)}</Badge></TableCell>
                            <TableCell className="text-right py-1">
                            <RecordActions
                                record={record}
                                onUpdate={handleUpdateRecord}
                                onEdit={setEditingRecord}
                                onDelete={setRecordToDelete}
                                />
                            </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
                </Table>
            </div>
            
            {/* CONTROLES DE PAGINACIÓN */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-2">
                    <p className="text-xs text-muted-foreground">
                        Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredRecords.length)} de {filteredRecords.length} registros
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs font-bold w-12 text-center">
                            {currentPage} / {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
            </>
          )}
      </CardContent>
    </Card>
    
    <RecordDialog 
        isOpen={!!editingRecord}
        onOpenChange={(open) => {
          if (!open) setEditingRecord(null);
        }}
        record={editingRecord}
        employees={employees}
        month={month!}
        onSave={handleSaveRecord}
    />

     <AlertDialog open={!!recordToDelete} onOpenChange={(open) => {
        if (!open) setRecordToDelete(null);
     }}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>¿Estás seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará permanentemente el registro de horas extra.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setRecordToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDeleteRecord()}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
