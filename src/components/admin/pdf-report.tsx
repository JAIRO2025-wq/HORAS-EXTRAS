'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Employee, OvertimeRecord, AttendanceRecord } from '@/lib/types';
import { useMemo } from 'react';
import { getOvertimeHoursFromRecord } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Clock, CalendarDays, BarChart3, User, Building, Shield } from 'lucide-react';

type PdfReportProps = {
  employee: Employee;
  records: OvertimeRecord[];
  attendanceRecords: AttendanceRecord[];
  month: string;
};

// Configuración de tamaños para simular Letter (Carta) a 96 DPI
// Letter es 8.5 x 11 pulgadas
const PAGE_WIDTH = "816px";
const PAGE_HEIGHT = "1056px";
const RECORDS_PER_FIRST_PAGE = 10; // Menos que A4 porque Letter es más corta
const RECORDS_PER_SUBSEQUENT_PAGE = 22;

export function PdfReport({ employee, records, attendanceRecords, month }: PdfReportProps) {
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const approvedRecords = useMemo(() => 
    records.filter(rec => rec.status === 'approved')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), 
  [records]);

  // Cálculos financieros
  const payrollData = useMemo(() => {
    let totalDayHours = 0;
    let totalNightHours = 0;
    const additionalDays = approvedRecords.filter(r => r.type === 'additional_day').length;

    for (const record of approvedRecords) {
      const overtime = getOvertimeHoursFromRecord(record);
      totalDayHours += overtime.dayHours;
      totalNightHours += overtime.nightHours;
    }

    const baseHourlyRate = employee.salary > 0 ? (employee.salary / 2 / 15 / 8) : 0;
    const dayPay = totalDayHours * (baseHourlyRate * 2);
    const nightPay = totalNightHours * (baseHourlyRate * 2 * 1.25);
    const additionalDayPay = additionalDays * (baseHourlyRate * 8);

    return {
      overtimePay: dayPay + nightPay,
      additionalDayPay,
      totalPay: dayPay + nightPay + additionalDayPay
    };
  }, [approvedRecords, employee.salary]);

  // Fragmentación de registros para paginación
  const pages = useMemo(() => {
    const allTableData = [...approvedRecords];
    const pagesList = [];
    
    // Primera página (con resumen)
    pagesList.push(allTableData.splice(0, RECORDS_PER_FIRST_PAGE));
    
    // Páginas siguientes
    while (allTableData.length > 0) {
      pagesList.push(allTableData.splice(0, RECORDS_PER_SUBSEQUENT_PAGE));
    }
    
    return pagesList;
  }, [approvedRecords]);

  const Header = ({ pageNum, totalPages }: { pageNum: number, totalPages: number }) => (
    <div className="flex justify-between items-start border-b-2 border-primary pb-4 mb-6">
      <div className="flex items-center gap-2">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-[16px] font-black text-primary leading-none uppercase">Reporte de Nómina e Incidencias</h1>
          <p className="text-[11px] text-zinc-500 font-bold uppercase mt-1">Flynet Business System - {month}</p>
        </div>
      </div>
      <div className="text-right text-[10px] text-zinc-400 font-bold uppercase">
        Página {pageNum} de {totalPages}
      </div>
    </div>
  );

  const Footer = () => (
    <div className="mt-auto pt-4 border-t border-zinc-100 flex justify-between items-center">
      <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest">Documento de Carácter Confidencial</span>
      <span className="text-[9px] font-bold text-zinc-400">Generado: {format(new Date(), "dd/MM/yyyy HH:mm")}</span>
    </div>
  );

  return (
    <div className="bg-zinc-200 p-4 space-y-8 flex flex-col items-center">
      {pages.map((pageRecords, index) => (
        <div 
          key={index} 
          className="pdf-page bg-white shadow-2xl overflow-hidden flex flex-col p-10"
          style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }}
        >
          <Header pageNum={index + 1} totalPages={pages.length} />

          {/* SÓLO EN PÁGINA 1: Resumen y Perfil */}
          {index === 0 && (
            <div className="space-y-6 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100 flex items-center gap-3">
                  <User className="h-4 w-4 text-primary" />
                  <div>
                    <span className="text-[9px] font-black text-zinc-400 uppercase block">Colaborador</span>
                    <span className="text-[13px] font-bold">{employee.name}</span>
                  </div>
                </div>
                <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100 flex items-center gap-3">
                  <Building className="h-4 w-4 text-primary" />
                  <div>
                    <span className="text-[9px] font-black text-zinc-400 uppercase block">Sucursal</span>
                    <span className="text-[13px] font-bold">{employee.branch}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                <h2 className="text-[12px] font-black uppercase text-primary mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Resumen Financiero del Período
                </h2>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase">Horas Extra</p>
                    <p className="text-[14px] font-black">{formatCurrency(payrollData.overtimePay)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase">Días Adic.</p>
                    <p className="text-[14px] font-black">{formatCurrency(payrollData.additionalDayPay)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase">Sueldo Base</p>
                    <p className="text-[14px] font-bold">{formatCurrency(employee.salary)}</p>
                  </div>
                  <div className="bg-primary p-2 rounded-lg text-white">
                    <p className="text-[9px] font-bold uppercase opacity-80">Neto a Recibir</p>
                    <p className="text-[16px] font-black">{formatCurrency(payrollData.totalPay)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TABLA DE REGISTROS (PAGINADA) */}
          <div className="flex-1">
            <h3 className="text-[12px] font-black uppercase text-zinc-700 mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" /> 
              {index === 0 ? 'Detalle de Actividades' : 'Continuación de Actividades'}
            </h3>
            <div className="rounded-lg border border-zinc-100 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-zinc-50 border-none h-8">
                    <TableHead className="text-[10px] font-black uppercase py-0 h-8">Fecha</TableHead>
                    <TableHead className="text-[10px] font-black uppercase py-0 h-8">Horario</TableHead>
                    <TableHead className="text-[10px] font-black uppercase py-0 h-8">Actividad Realizada</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase py-0 h-8">Hrs.</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase py-0 h-8">Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRecords.map(record => {
                    const hrs = getOvertimeHoursFromRecord(record);
                    return (
                      <TableRow key={record.id} className="border-b border-zinc-50 h-9">
                        <TableCell className="text-[11px] font-bold py-1">{format(record.date, 'dd/MM/yy')}</TableCell>
                        <TableCell className="text-[10px] font-mono py-1">{record.startTime} - {record.endTime}</TableCell>
                        <TableCell className="text-[10px] max-w-[250px] truncate py-1 text-zinc-600">{record.activity}</TableCell>
                        <TableCell className="text-right text-[11px] font-black py-1">{(record.totalHours ?? 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right py-1">
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-zinc-100 rounded border border-zinc-200">
                            {record.type === 'additional_day' ? 'Día Adic.' : 'H. Extra'}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* FIRMAS (SÓLO AL FINAL) */}
          {index === pages.length - 1 && (
            <div className="mt-12 grid grid-cols-2 gap-20 px-10">
              <div className="text-center border-t border-zinc-300 pt-2">
                <p className="text-[11px] font-black uppercase">{employee.name}</p>
                <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Firma Empleado</p>
              </div>
              <div className="text-center border-t border-zinc-300 pt-2">
                <p className="text-[11px] font-black uppercase">Recursos Humanos</p>
                <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Sello y Firma</p>
              </div>
            </div>
          )}

          <Footer />
        </div>
      ))}
    </div>
  );
}
