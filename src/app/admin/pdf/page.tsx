'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Employee, OvertimeRecord, Branch, AttendanceRecord } from '@/lib/types';
import { Loader2, User, Printer, CalendarDays, Building, CalendarRange } from 'lucide-react';
import { openOvertimeReportPdfWindow } from '@/lib/overtime-report-pdf-window';
import { getOvertimeHoursFromRecord } from '@/lib/utils';
import { months } from '@/lib/data';

export default function AdminPdfPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [records, setRecords] = useState<OvertimeRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedQuincena, setSelectedQuincena] = useState<string>('all');
  const [month, setMonth] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

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
        const [recordsResponse, employeesResponse, branchesResponse, attendanceResponse] = await Promise.all([
          fetch(`/api/admin/all-records?month=${encodeURIComponent(month)}`),
          fetch('/api/employees'),
          fetch('/api/branches'),
          fetch(`/api/admin/attendance?month=${encodeURIComponent(month)}`)
        ]);

        if (!recordsResponse.ok) throw new Error('Failed to fetch records');
        if (!employeesResponse.ok) throw new Error('Failed to fetch employees');
        if (!branchesResponse.ok) throw new Error('Failed to fetch branches');
        if (!attendanceResponse.ok) throw new Error('Failed to fetch attendance');

        const recordsData = await recordsResponse.json();
        const employeesData = await employeesResponse.json();
        const branchesData = await branchesResponse.json();
        const attendanceData = await attendanceResponse.json();

        setRecords(recordsData.map((rec: any) => ({ ...rec, date: new Date(rec.date) })));
        setEmployees(employeesData.filter((e: Employee) => e.status === 'active'));
        setBranches(branchesData);
        setAttendanceRecords(attendanceData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [month]);
  
  const handleMonthChange = (newMonth: string) => {
    const storedAdmin = localStorage.getItem('overtimeAdmin');
    if (storedAdmin) {
      const parsedAdmin = JSON.parse(storedAdmin);
      const newAdminUser = { ...parsedAdmin, month: newMonth };
      localStorage.setItem('overtimeAdmin', JSON.stringify(newAdminUser));
      window.location.reload();
    }
  };

  const filteredEmployees = useMemo(() => {
    if (selectedBranch === 'all') {
      return employees;
    }
    return employees.filter(e => e.branch === selectedBranch);
  }, [employees, selectedBranch]);

  // Resumen por empleado: solo quienes tienen horas registradas en el período.
  const employeeSummaries = useMemo(() => {
    const byName = new Map<string, OvertimeRecord[]>();
    for (const rec of records) {
      const name = (rec as any).employeeName as string;
      if (!name) continue;
      // Filtro por quincena (1, 2 o todas)
      if (selectedQuincena !== 'all' && String(rec.quincena) !== selectedQuincena) continue;
      const list = byName.get(name) || [];
      list.push(rec);
      byName.set(name, list);
    }

    return filteredEmployees
      .map(emp => {
        const empRecords = byName.get(emp.name) || [];
        const approved = empRecords.filter(r => r.status === 'approved');
        let totalHours = 0;
        let dayHours = 0;
        let nightHours = 0;
        for (const r of approved) {
          const h = getOvertimeHoursFromRecord(r);
          totalHours += r.totalHours ?? 0;
          dayHours += h.dayHours;
          nightHours += h.nightHours;
        }
        const quincenas = Array.from(new Set(approved.map(r => r.quincena).filter(Boolean))).sort();
        return {
          employee: emp,
          records: empRecords,
          approvedCount: approved.length,
          pendingCount: empRecords.filter(r => r.status === 'pending').length,
          totalHours,
          dayHours,
          nightHours,
          quincenas,
        };
      })
      .filter(s => s.records.length > 0)
      .sort((a, b) => b.totalHours - a.totalHours);
  }, [filteredEmployees, records, selectedQuincena]);

  const handleGenerateFor = async (employee: Employee, empRecords: OvertimeRecord[]) => {
    if (!month || isGenerating) return;
    setSelectedEmployee(employee);
    setIsGenerating(true);
    try {
      const approved = empRecords.filter(r => r.status === 'approved');
      const quincenas = Array.from(new Set(approved.map(r => r.quincena).filter(Boolean))).sort();

      // El reporte incluye aprobados y rechazados (los pendientes no tienen dictamen).
      const reportable = empRecords.filter(r => r.status === 'approved' || r.status === 'rejected');

      // Quincena efectiva del reporte: la del filtro o la única detectada.
      const effectiveQuincena = selectedQuincena !== 'all'
        ? Number(selectedQuincena)
        : (quincenas.length === 1 ? quincenas[0] : null);

      // Guarda un snapshot del reporte para que el QR apunte a su vista web.
      let shareId: string | undefined;
      try {
        const res = await fetch('/api/reports/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeName: employee.name,
            month,
            quincena: effectiveQuincena,
            records: reportable.map(r => ({
              date: r.date,
              startTime: r.startTime,
              endTime: r.endTime,
              activity: r.activity,
              coworkers: r.coworkers,
              quincena: r.quincena,
              totalHours: r.totalHours,
              dayHours: getOvertimeHoursFromRecord(r).dayHours,
              nightHours: getOvertimeHoursFromRecord(r).nightHours,
              type: r.type,
              status: r.status,
            })),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          shareId = data.id;
        }
      } catch (e) {
        console.error('No se pudo generar el enlace del QR:', e);
      }

      openOvertimeReportPdfWindow(employee, empRecords, month, shareId, effectiveQuincena);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePdf = () => {
    if (!selectedEmployee || !employeeData) return;
    handleGenerateFor(selectedEmployee, employeeData.records);
  };

  const employeeData = useMemo(() => {
    if (!selectedEmployee) return null;
    return {
      employee: selectedEmployee,
      records: records.filter(r => (r as any).employeeName === selectedEmployee.name),
      attendance: attendanceRecords.filter(r => r.employeeName === selectedEmployee.name)
    };
  }, [selectedEmployee, records, attendanceRecords]);

  useEffect(() => {
    setSelectedEmployee(null);
  }, [selectedBranch]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generador de Reportes PDF</CardTitle>
          <CardDescription>
            Vista previa de los colaboradores con horas registradas en el período. Genera el reporte
            individual en formato Carta (Letter) con código QR de consulta digital.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
                <Select
                    value={selectedBranch}
                    onValueChange={setSelectedBranch}
                    disabled={isLoading}
                >
                    <SelectTrigger>
                        <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            <SelectValue placeholder={isLoading ? "Cargando..." : "Selecciona sucursal"} />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas las Sucursales</SelectItem>
                        {branches.map(b => (
                            <SelectItem key={b.id} value={b.name}>
                                {b.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {month && (
              <div className="flex-1 w-full">
                <Select value={month} onValueChange={handleMonthChange}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Selecciona mes" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex-1 w-full">
                <Select
                    value={selectedQuincena}
                    onValueChange={setSelectedQuincena}
                    disabled={isLoading}
                >
                    <SelectTrigger>
                        <div className="flex items-center gap-2">
                            <CalendarRange className="h-4 w-4 text-muted-foreground" />
                            <SelectValue placeholder="Quincena" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Ambas Quincenas</SelectItem>
                        <SelectItem value="1">Primera Quincena (Q1)</SelectItem>
                        <SelectItem value="2">Segunda Quincena (Q2)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>

      {isLoading && <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}

      {!isLoading && employeeSummaries.length === 0 && (
        <Card className="text-center p-12">
            <CardContent>
                <User className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-[12px] font-bold uppercase">Sin horas registradas</h3>
                <p className="mt-1 text-[11px] text-muted-foreground">
                    Ningún colaborador de la sucursal seleccionada tiene horas registradas en {month || 'el período'}
                    {selectedQuincena !== 'all' ? ` (Q${selectedQuincena})` : ''}.
                </p>
            </CardContent>
        </Card>
      )}

      {!isLoading && employeeSummaries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Resumen del período — {month}</CardTitle>
                <CardDescription>
                  {employeeSummaries.length} colaborador(es) con horas registradas.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase">
                {employeeSummaries.reduce((acc, s) => acc + s.totalHours, 0).toFixed(2)} hrs aprobadas
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="py-2">Colaborador</TableHead>
                    <TableHead className="py-2">Sucursal</TableHead>
                    <TableHead className="py-2 text-center">Quincena</TableHead>
                    <TableHead className="py-2 text-center">Registros</TableHead>
                    <TableHead className="py-2 text-right">Diurnas</TableHead>
                    <TableHead className="py-2 text-right">Nocturnas</TableHead>
                    <TableHead className="py-2 text-right">Total Horas</TableHead>
                    <TableHead className="py-2 text-center">Estado</TableHead>
                    <TableHead className="py-2 text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeSummaries.map((s) => (
                    <TableRow key={s.employee.id} className="even:bg-muted/10 hover:bg-muted/30 transition-colors">
                      <TableCell className="py-2 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground">[{s.employee.id}]</span>
                          <span>{s.employee.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-[11px] text-muted-foreground">{s.employee.branch}</TableCell>
                      <TableCell className="py-2 text-center text-[11px] font-semibold">
                        {s.quincenas.length > 0 ? s.quincenas.map(q => `Q${q}`).join(' y ') : '--'}
                      </TableCell>
                      <TableCell className="py-2 text-center text-[11px]">
                        <span className="font-bold text-emerald-700">{s.approvedCount}</span>
                        {s.pendingCount > 0 && <span className="text-orange-600"> + {s.pendingCount} pend.</span>}
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono text-[11px] text-amber-800">{s.dayHours.toFixed(2)}</TableCell>
                      <TableCell className="py-2 text-right font-mono text-[11px] text-indigo-800">{s.nightHours.toFixed(2)}</TableCell>
                      <TableCell className="py-2 text-right font-mono font-bold text-sky-900">{s.totalHours.toFixed(2)}</TableCell>
                      <TableCell className="py-2 text-center">
                        {s.approvedCount > 0
                          ? <Badge variant="secondary" className="text-[9px] h-5">Aprobado</Badge>
                          : <Badge variant="outline" className="text-[9px] h-5">Sin aprobar</Badge>}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5"
                          disabled={isGenerating || s.approvedCount === 0}
                          onClick={() => handleGenerateFor(s.employee, s.records)}
                        >
                          {isGenerating && selectedEmployee?.id === s.employee.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Printer className="h-3.5 w-3.5" />}
                          <span>Generar PDF</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
