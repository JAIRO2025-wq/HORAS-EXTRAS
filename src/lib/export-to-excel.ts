import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { PermitRequest } from '@/lib/types';
import { format, parseISO, isValid } from 'date-fns';

const exportToExcel = (data: PermitRequest[], fileName: string) => {
  const wb = XLSX.utils.book_new();

  // Agrupar permisos por empleado para crear pestañas individuales
  const groupedByEmployee: { [key: string]: PermitRequest[] } = data.reduce((acc, permit) => {
    const employeeName = permit.employeeName || 'Sin Nombre';
    if (!acc[employeeName]) {
      acc[employeeName] = [];
    }
    acc[employeeName].push(permit);
    return acc;
  }, {} as { [key: string]: PermitRequest[] });

  // Crear una hoja para cada empleado
  for (const employeeName in groupedByEmployee) {
    if (Object.prototype.hasOwnProperty.call(groupedByEmployee, employeeName)) {
      const employeePermits = groupedByEmployee[employeeName];
      
      // Definir los encabezados solicitados
      const ws_data = [
        [
          'ID SOLICITUD', 
          'FECHA SOLICITUD', 
          'DESDE (FECHA)', 
          'HASTA (FECHA)', 
          'SUCURSAL', 
          'ACCIÓN / TRÁMITE', 
          'JUSTIFICACIÓN / MOTIVO', 
          'ESTADO', 
          'NOTAS ADMINISTRACIÓN'
        ],
        ...employeePermits.map(permit => {
          // Formatear fechas de forma segura
          const formatDate = (dateStr: string) => {
            if (!dateStr) return 'N/A';
            const date = parseISO(dateStr);
            return isValid(date) ? format(date, 'dd/MM/yyyy') : dateStr;
          };

          const formatDateTime = (dateStr: string) => {
            if (!dateStr) return 'N/A';
            const date = parseISO(dateStr);
            return isValid(date) ? format(date, 'dd/MM/yyyy HH:mm') : dateStr;
          };

          // Intentamos obtener el motivo de múltiples campos por compatibilidad
          const motivo = permit.justification || permit.reason || 'Sin descripción';

          return [
            permit.id.substring(0, 8).toUpperCase(),
            formatDateTime(permit.requestDate),
            formatDate(permit.startDate),
            formatDate(permit.endDate),
            permit.branch,
            permit.action,
            motivo, 
            permit.status === 'approved' ? 'APROBADO' : permit.status === 'rejected' ? 'RECHAZADO' : 'PENDIENTE',
            permit.adminNotes || ''
          ];
        }),
      ];

      const ws = XLSX.utils.aoa_to_sheet(ws_data);

      // Ajustar anchos de columna para mejor legibilidad
      const wscols = [
        { wch: 15 }, // ID
        { wch: 20 }, // Fecha Solicitud
        { wch: 15 }, // Desde
        { wch: 15 }, // Hasta
        { wch: 15 }, // Sucursal
        { wch: 30 }, // Acción
        { wch: 50 }, // Justificación
        { wch: 15 }, // Estado
        { wch: 40 }, // Notas
      ];
      ws['!cols'] = wscols;

      XLSX.utils.book_append_sheet(wb, ws, employeeName.substring(0, 31)); 
    }
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });

  function s2ab(s: string) {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) {
      view[i] = s.charCodeAt(i) & 0xFF;
    }
    return buf;
  }

  saveAs(new Blob([s2ab(wbout)], { type: 'application/octet-stream' }), `${fileName}.xlsx`);
};

export default exportToExcel;
