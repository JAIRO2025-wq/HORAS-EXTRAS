
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import type { OvertimeRecord, Employee, Branch } from '@/lib/types';
import { DollarSign, Loader2, FileDown, Search, Filter, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { getOvertimeHoursFromRecord } from '@/lib/utils';

type OvertimeRecordWithEmployee = OvertimeRecord & { employeeName: string };

type PayrollData = {
  employeeName: string;
  salary: number;
  baseHourlyRate: number;
  totalDayHours: number;
  dayPay: number;
  totalNightHours: number;
  nightPay: number;
  overtimePay: number;
  additionalDays: number;
  additionalDayPay: number;
  totalPay: number;
  isUnknownEmployee?: boolean;
};

export default function AdminPayrollPage() {
  const [records, setRecords] = useState<OvertimeRecordWithEmployee[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [month, setMonth] = useState<string | null>(null);
  
  const [quincenaFilter, setQuincenaFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const storedAdmin = localStorage.getItem('overtimeAdmin');
    if (storedAdmin) {
      const parsedAdmin = JSON.parse(storedAdmin);
      setMonth(parsedAdmin.month);
    }
  }, []);

  useEffect(() => {
    if (!month) return;

    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        const [recordsResponse, employeesResponse, branchesResponse] = await Promise.all([
          fetch(`/api/admin/all-records?month=${encodeURIComponent(month)}`),
          fetch('/api/employees'),
          fetch('/api/branches'),
        ]);

        if (!recordsResponse.ok) throw new Error('Failed to fetch records');
        
        const recordsData = await recordsResponse.json();
        setRecords(recordsData.map((rec: any) => ({ ...rec, date: new Date(rec.date) })));
        setEmployees(await employeesResponse.json());
        setBranches(await branchesResponse.json());
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [month]);

  // Helper para buscar empleados de forma robusta (flexible matching)
  const findOfficialEmployee = useCallback((nameInRecord: string) => {
    const normalizedSearch = nameInRecord.toUpperCase().trim();
    let employee = employees.find(e => e.name.toUpperCase().trim() === normalizedSearch);
    
    if (!employee) {
        employee = employees.find(e => {
            const sysName = e.name.toUpperCase().trim();
            return sysName.includes(normalizedSearch) || normalizedSearch.includes(sysName);
        });
    }
    return employee;
  }, [employees]);

  const approvedFilteredRecords = useMemo(() => {
    return records.filter((rec) => {
      if (rec.status !== 'approved') return false;
      const matchQuincena = quincenaFilter === 'all' || rec.quincena.toString() === quincenaFilter;
      const matchType = typeFilter === 'all' || rec.type === typeFilter;
      return matchQuincena && matchType;
    });
  }, [records, quincenaFilter, typeFilter]);

  const payrollData: PayrollData[] = useMemo(() => {
    const namesInRecords = Array.from(new Set(approvedFilteredRecords.map(r => r.employeeName)));
    
    return namesInRecords.map((nameInRecord) => {
        const employeeRecords = approvedFilteredRecords.filter(r => r.employeeName === nameInRecord);
        const employee = findOfficialEmployee(nameInRecord);

        if (branchFilter !== 'all' && employee && employee.branch !== branchFilter) return null;
        if (branchFilter !== 'all' && !employee) return null;
        if (searchTerm.trim() && !nameInRecord.toLowerCase().includes(searchTerm.toLowerCase())) return null;

        let totalDayHours = 0;
        let totalNightHours = 0;
        const additionalDays = employeeRecords.filter(r => r.type === 'additional_day').length;

        for (const record of employeeRecords) {
            const hrs = getOvertimeHoursFromRecord(record);
            totalDayHours += (hrs.dayHours || 0);
            totalNightHours += (hrs.nightHours || 0);
        }
        
        if (totalDayHours === 0 && totalNightHours === 0 && additionalDays === 0) return null;

        const salary = employee?.salary || 0;
        const baseHourlyRate = salary > 0 ? (salary / 2 / 15 / 8) : 0;
        const dayRate = baseHourlyRate * 2;
        const nightRate = dayRate * 1.25;
        
        const dayPay = totalDayHours * dayRate;
        const nightPay = totalNightHours * nightRate;
        const overtimePay = dayPay + nightPay;
        const additionalDayPay = additionalDays * baseHourlyRate * 8;
        const totalPay = overtimePay + additionalDayPay;

        return {
          employeeName: employee?.name || nameInRecord, 
          salary, 
          baseHourlyRate,
          totalDayHours, 
          dayPay, 
          totalNightHours, 
          nightPay, 
          overtimePay,
          additionalDays, 
          additionalDayPay, 
          totalPay,
          isUnknownEmployee: !employee
        };
      })
      .filter((data): data is PayrollData => data !== null)
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [approvedFilteredRecords, branchFilter, searchTerm, findOfficialEmployee]);

  const totals = useMemo(() => {
    return payrollData.reduce((acc, item) => ({
        totalDayHours: acc.totalDayHours + item.totalDayHours, 
        dayPay: acc.dayPay + item.dayPay,
        totalNightHours: acc.totalNightHours + item.totalNightHours, 
        nightPay: acc.nightPay + item.nightPay,
        overtimePay: acc.overtimePay + item.overtimePay, 
        additionalDays: acc.additionalDays + item.additionalDays,
        additionalDayPay: acc.additionalDayPay + item.additionalDayPay, 
        totalPay: acc.totalPay + item.totalPay,
      }), { totalDayHours: 0, dayPay: 0, totalNightHours: 0, nightPay: 0, overtimePay: 0, additionalDays: 0, additionalDayPay: 0, totalPay: 0 });
  }, [payrollData]);

  const handleExport = useCallback(async () => {
    if (payrollData.length === 0) return;
    setIsExporting(true);

    try {
        const workbook = new ExcelJS.Workbook();
        const blueHeader = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } };
        const greenFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
        const whiteBold = { color: { argb: 'FFFFFFFF' }, bold: true };

        // --- HOJA 1: RESUMEN GENERAL ---
        const sheet1 = workbook.addWorksheet('Resumen de Pagos');
        sheet1.addRow(['RESUMEN DE NOMINA - ' + month]);
        sheet1.getCell('A1').font = { size: 16, bold: true };
        sheet1.addRow([]);

        const headers1 = ['Empleado', 'Salario Base', 'Valor Hora', 'H. Diurnas', 'Pago Diurno', 'H. Nocturnas', 'Pago Nocturno', 'Total HE', 'Días Adic.', 'Pago Adic.', 'PAGO TOTAL'];
        const hr1 = sheet1.addRow(headers1);
        hr1.eachCell(cell => { cell.fill = blueHeader; cell.font = whiteBold; });

        payrollData.forEach(item => {
            const row = sheet1.addRow([
                item.employeeName, item.salary, item.baseHourlyRate,
                item.totalDayHours, item.dayPay, item.totalNightHours,
                item.nightPay, item.overtimePay, item.additionalDays,
                item.additionalDayPay, item.totalPay
            ]);
            row.getCell(5).fill = greenFill; row.getCell(7).fill = greenFill;
        });
        sheet1.columns = [{ width: 25 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 12 }, { width: 15 }];

        // --- HOJA 2: DESGLOSE DETALLADO ---
        const sheet2 = workbook.addWorksheet('Desglose Detallado');
        sheet2.addRow(['DETALLE FINANCIERO POR REGISTRO - ' + month]);
        sheet2.getCell('A1').font = { size: 16, bold: true };
        sheet2.addRow([]);
        
        const headers2 = ['Empleado', 'Fecha', 'Actividad', 'Salario Base', 'Valor Hora', 'H. Diurnas', 'Pago Diurno', 'H. Nocturnas', 'Pago Nocturno', 'Días Adic.', 'Pago Adic.', 'PAGO TOTAL', 'Detalle de Subtotal'];
        const hr2 = sheet2.addRow(headers2);
        hr2.eachCell(c => { c.fill = blueHeader; c.font = whiteBold; });

        const sorted = [...approvedFilteredRecords].sort((a, b) => a.employeeName.localeCompare(b.employeeName) || a.date.getTime() - b.date.getTime());
        
        let currentEmpInLoop = "";
        let empTotals = { salary: 0, rate: 0, dH: 0, dP: 0, nH: 0, nP: 0, aD: 0, aP: 0, tP: 0 };
        let empActs: string[] = [];

        const addSubtotalRow = (nameFromRecord: string) => {
            const officialEmp = findOfficialEmployee(nameFromRecord);
            const displayName = officialEmp?.name || nameFromRecord;
            const totalHE = empTotals.dH + empTotals.nH;
            const uniqueActs = Array.from(new Set(empActs)).filter(a => a.length > 0);
            const detailText = `${totalHE.toFixed(2)} HE + ${empTotals.aD} DÍAS ADICIONALES. ACTIVIDADES: ${uniqueActs.map((a, i) => `${i + 1}. ${a}`).join(', ')}`;
            
            const row = sheet2.addRow([
                `SUBTOTAL ${displayName}`, '', '--- ACUMULADO ---', 
                empTotals.salary, empTotals.rate,
                parseFloat(empTotals.dH.toFixed(2)), empTotals.dP, 
                parseFloat(empTotals.nH.toFixed(2)), empTotals.nP,
                empTotals.aD, empTotals.aP, empTotals.tP,
                detailText
            ]);
            row.eachCell(c => c.font = { bold: true });
            row.getCell(13).alignment = { wrapText: true };
            sheet2.addRow([]);
            // Reset
            empTotals = { salary: 0, rate: 0, dH: 0, dP: 0, nH: 0, nP: 0, aD: 0, aP: 0, tP: 0 }; 
            empActs = [];
        };

        sorted.forEach((r, idx) => {
            if (currentEmpInLoop !== "" && currentEmpInLoop !== r.employeeName) {
                addSubtotalRow(currentEmpInLoop);
            }
            
            // Buscar datos del empleado para cálculos financieros usando el buscador robusto
            const emp = findOfficialEmployee(r.employeeName);
            const salary = emp?.salary || 0;
            const rate = salary > 0 ? (salary / 2 / 15 / 8) : 0;
            const hrs = getOvertimeHoursFromRecord(r);
            
            const dayP = hrs.dayHours * (rate * 2);
            const nightP = hrs.nightHours * (rate * 2 * 1.25);
            const adicP = r.type === 'additional_day' ? (rate * 8) : 0;
            const rowTotal = dayP + nightP + adicP;

            const row = sheet2.addRow([
                emp?.name || r.employeeName, 
                format(r.date, 'dd/MM/yyyy'), 
                r.activity,
                salary,
                rate,
                parseFloat(hrs.dayHours.toFixed(2)),
                dayP,
                parseFloat(hrs.nightHours.toFixed(2)),
                nightP,
                r.type === 'additional_day' ? 1 : 0,
                adicP,
                rowTotal,
                ''
            ]);

            row.getCell(7).fill = greenFill;
            row.getCell(9).fill = greenFill;

            currentEmpInLoop = r.employeeName;
            empTotals.salary = salary;
            empTotals.rate = rate;
            empTotals.dH += hrs.dayHours;
            empTotals.dP += dayP;
            empTotals.nH += hrs.nightHours;
            empTotals.nP += nightP;
            empTotals.aD += r.type === 'additional_day' ? 1 : 0;
            empTotals.aP += adicP;
            empTotals.tP += rowTotal;
            if (r.activity) empActs.push(r.activity);
            
            if (idx === sorted.length - 1) addSubtotalRow(currentEmpInLoop);
        });

        sheet2.columns = [
            { width: 25 }, { width: 12 }, { width: 35 }, { width: 12 }, { width: 12 }, 
            { width: 10 }, { width: 12 }, { width: 10 }, { width: 12 }, { width: 10 }, 
            { width: 12 }, { width: 15 }, { width: 60 }
        ];

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Nomina_Integrada_${month}.xlsx`);
        toast({ title: "Excel generado" });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: "Error al exportar" });
    } finally {
        setIsExporting(false);
    }
  }, [payrollData, month, approvedFilteredRecords, findOfficialEmployee, toast]);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <CardTitle>Cálculo de Nómina Integrado</CardTitle>
              <CardDescription>Resumen basado en registros aprobados para {month}.</CardDescription>
            </div>
            <Button onClick={handleExport} disabled={isLoading || isExporting || payrollData.length === 0} className="bg-green-600 hover:bg-green-700 text-white gap-2 h-10 px-6 border-none shadow-md">
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} 
                Exportar Planilla
            </Button>
          </div>

          <div className="flex flex-wrap gap-3 mt-6 p-4 bg-muted/30 rounded-xl border border-dashed items-center">
            <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por empleado..." className="pl-8 h-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Sucursal" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todas las Sucursales</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={quincenaFilter} onValueChange={setQuincenaFilter}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Quincena" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todo el Mes</SelectItem>
                    <SelectItem value="1">1ra Quincena</SelectItem>
                    <SelectItem value="2">2da Quincena</SelectItem>
                </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    <SelectItem value="overtime">Horas Extra</SelectItem>
                    <SelectItem value="additional_day">Días Adicionales</SelectItem>
                </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <div className="rounded-md border overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow>
                        <TableHead className="py-1 h-8 text-[10px] uppercase">Empleado</TableHead>
                        <TableHead className="text-right py-1 h-8 text-[10px] uppercase">Salario Base</TableHead>
                        <TableHead className="text-right py-1 h-8 text-[10px] uppercase">V. Hora</TableHead>
                        <TableHead className="text-right py-1 h-8 text-[10px] uppercase">Pago Diurno</TableHead>
                        <TableHead className="text-right py-1 h-8 text-[10px] uppercase">Pago Noct.</TableHead>
                        <TableHead className="text-right py-1 h-8 text-[10px] uppercase">Pago Adic.</TableHead>
                        <TableHead className="text-right font-black text-primary py-1 h-8 text-[10px] uppercase">Total Pagar</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollData.length > 0 ? payrollData.map((item) => (
                    <TableRow key={item.employeeName} className="hover:bg-muted/30 even:bg-muted/10 transition-colors border-b">
                      <TableCell className="font-bold py-1 h-9">
                        <div className="flex flex-col">
                            <span className="text-xs">{item.employeeName}</span>
                            {item.isUnknownEmployee && (
                                <Badge variant="outline" className="text-[7px] h-3 px-1 w-fit bg-amber-50 text-amber-700 border-amber-200">
                                    <AlertTriangle className="h-2 w-2 mr-1" /> Sin Salario
                                </Badge>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-[11px] py-1 h-9">{formatCurrency(item.salary)}</TableCell>
                      <TableCell className="text-right font-mono text-[11px] py-1 h-9 text-muted-foreground">{formatCurrency(item.baseHourlyRate)}</TableCell>
                      <TableCell className="text-right font-mono text-[11px] py-1 h-9 bg-green-50/20">{formatCurrency(item.dayPay)}</TableCell>
                      <TableCell className="text-right font-mono text-[11px] py-1 h-9 bg-green-50/20">{formatCurrency(item.nightPay)}</TableCell>
                      <TableCell className="text-right font-mono text-[11px] py-1 h-9 bg-blue-50/20">{formatCurrency(item.additionalDayPay)}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-primary py-1 h-9 text-sm">{formatCurrency(item.totalPay)}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground italic">
                            No hay horas aprobadas con los filtros actuales.
                        </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {payrollData.length > 0 && (
                    <TableFooter className="bg-primary/5 font-black">
                        <TableRow>
                            <TableCell className="py-2 text-xs">TOTALES ({payrollData.length} PERS.)</TableCell>
                            <TableCell colSpan={2}></TableCell>
                            <TableCell className="text-right py-2 text-xs">{formatCurrency(totals.dayPay)}</TableCell>
                            <TableCell className="text-right py-2 text-xs">{formatCurrency(totals.nightPay)}</TableCell>
                            <TableCell className="text-right py-2 text-xs">{formatCurrency(totals.additionalDayPay)}</TableCell>
                            <TableCell className="text-right text-primary text-base py-2">{formatCurrency(totals.totalPay)}</TableCell>
                        </TableRow>
                    </TableFooter>
                )}
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
