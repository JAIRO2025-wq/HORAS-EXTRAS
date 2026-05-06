'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Employee, OvertimeRecord, Branch, AttendanceRecord } from '@/lib/types';
import { Loader2, User, Printer, CalendarDays, Building } from 'lucide-react';
import { PdfReport } from '@/components/admin/pdf-report';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { months } from '@/lib/data';

export default function AdminPdfPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [records, setRecords] = useState<OvertimeRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [month, setMonth] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

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

  const handleGeneratePdf = async () => {
    if (!reportRef.current || !selectedEmployee || !month) return;

    setIsGenerating(true);
    try {
      // 1. Obtener todas las páginas renderizadas
      const pageElements = reportRef.current.querySelectorAll('.pdf-page');
      if (pageElements.length === 0) return;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter', // Cambiado a Letter
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < pageElements.length; i++) {
        const element = pageElements[i] as HTMLElement;
        
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        
        if (i > 0) pdf.addPage();
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      }

      pdf.save(`Reporte_Integral_${selectedEmployee.name.replace(/ /g, '_')}_${month}.pdf`);
      
    } catch (error) {
        console.error("Error generating multi-page PDF:", error);
    } finally {
        setIsGenerating(false);
    }
  };
  
  const filteredEmployees = useMemo(() => {
    if (selectedBranch === 'all') {
      return employees;
    }
    return employees.filter(e => e.branch === selectedBranch);
  }, [employees, selectedBranch]);

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
            Genera reportes multi-página profesionales en formato Carta (Letter) con alta calidad.
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
            <div className="flex-1 w-full">
                <Select
                    onValueChange={(employeeId) => {
                        const emp = employees.find(e => e.id.toString() === employeeId);
                        setSelectedEmployee(emp || null);
                    }}
                    value={selectedEmployee?.id.toString() || ''}
                    disabled={isLoading || filteredEmployees.length === 0}
                >
                    <SelectTrigger>
                        <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <SelectValue placeholder={isLoading ? "Cargando..." : "Selecciona un empleado"} />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        {filteredEmployees.map(emp => (
                            <SelectItem key={emp.id} value={emp.id.toString()}>
                                [{emp.id}] - {emp.name}
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
            <Button onClick={handleGeneratePdf} disabled={!selectedEmployee || isGenerating} className="w-full sm:w-auto">
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                {isGenerating ? 'Generando...' : 'Generar PDF'}
            </Button>
        </CardContent>
      </Card>

      {isLoading && <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}

      {!isLoading && selectedEmployee && employeeData && month && (
        <div ref={reportRef}>
             <PdfReport
                employee={employeeData.employee}
                records={employeeData.records}
                attendanceRecords={employeeData.attendance}
                month={month}
            />
        </div>
      )}
      {!isLoading && !selectedEmployee && (
        <Card className="text-center p-12">
            <CardContent>
                <User className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-[12px] font-bold uppercase">Selecciona un empleado</h3>
                <p className="mt-1 text-[11px] text-muted-foreground">
                    El reporte se paginará automáticamente si existen muchos registros.
                </p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
