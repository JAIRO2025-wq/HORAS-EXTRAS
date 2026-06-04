import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { PermitRequest } from '@/lib/types';
import { format, parseISO, isValid } from 'date-fns';

/**
 * Exportador de Permisos con estilos corporativos Flynet.
 * Genera un archivo Excel con una sola hoja consolidada y diseño profesional.
 */
const exportToExcel = async (data: PermitRequest[], fileName: string) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Permisos Consolidados');

  // Definición de Estilos (Mismo estándar que Nómina y Reportes)
  const blueHeaderFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0070C0' }
  };
  const whiteBoldFont: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true };
  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  // Orden oficial de sucursales solicitado
  const branchOrder = [
    'SAN MIGUEL',
    'MORAZAN',
    'USULUTAN',
    'SAN VICENTE',
    'CARA SUCIA',
    'SAN SALVADOR'
  ];

  // Ordenar datos: Sucursal (Orden Oficial) -> Empleado -> Fecha
  const sortedData = [...data].sort((a, b) => {
    const branchA = a.branch?.toUpperCase() || '';
    const branchB = b.branch?.toUpperCase() || '';
    
    const indexA = branchOrder.indexOf(branchA);
    const indexB = branchOrder.indexOf(branchB);
    
    const finalIndexA = indexA === -1 ? 99 : indexA;
    const finalIndexB = indexB === -1 ? 99 : indexB;

    if (finalIndexA !== finalIndexB) {
      return finalIndexA - finalIndexB;
    }

    const nameA = a.employeeName?.toUpperCase() || '';
    const nameB = b.employeeName?.toUpperCase() || '';
    
    if (nameA !== nameB) {
      return nameA.localeCompare(nameB);
    }

    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  // 1. Título del Reporte
  const titleRow = worksheet.addRow(['REPORTE INTEGRADO DE ACCIONES DE PERSONAL Y PERMISOS']);
  titleRow.font = { size: 14, bold: true, color: { argb: 'FF000000' } };
  worksheet.mergeCells('A1:J1');
  titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.addRow([]); // Fila vacía de separación

  // 2. Definir Encabezados
  const headers = [
    'SUCURSAL',
    'EMPLEADO',
    'ACCIÓN / TRÁMITE',
    'DESDE (FECHA)',
    'HASTA (FECHA)',
    'JUSTIFICACIÓN / MOTIVO',
    'ESTADO',
    'FECHA SOLICITUD',
    'ID SOLICITUD',
    'NOTAS ADMINISTRACIÓN'
  ];
  
  const headerRow = worksheet.addRow(headers);
  headerRow.height = 25;
  headerRow.eachCell((cell) => {
    cell.fill = blueHeaderFill;
    cell.font = whiteBoldFont;
    cell.border = borderStyle;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // 3. Configurar anchos de columna
  worksheet.columns = [
    { width: 18 }, // Sucursal
    { width: 35 }, // Empleado
    { width: 35 }, // Acción
    { width: 15 }, // Desde
    { width: 15 }, // Hasta
    { width: 50 }, // Justificación
    { width: 22 }, // Estado
    { width: 20 }, // Fecha Solicitud
    { width: 12 }, // ID
    { width: 40 }, // Notas
  ];

  // 4. Añadir Datos
  sortedData.forEach(permit => {
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

    let statusText = 'PENDIENTE';
    if (permit.status === 'approved') statusText = 'APROBADO FINAL';
    if (permit.status === 'rejected') statusText = 'RECHAZADO';
    if (permit.status === 'pending_admin') statusText = 'ESPERA FIRMA ADMIN';

    const rowData = [
      permit.branch?.toUpperCase() || 'N/A',
      permit.employeeName || 'Sin Nombre',
      permit.action,
      formatDate(permit.startDate),
      formatDate(permit.endDate),
      permit.justification || permit.reason || 'Sin descripción',
      statusText,
      formatDateTime(permit.requestDate),
      permit.id.substring(0, 8).toUpperCase(),
      permit.adminNotes || ''
    ];

    const row = worksheet.addRow(rowData);
    row.eachCell((cell) => {
      cell.border = borderStyle;
      cell.alignment = { vertical: 'middle', wrapText: true, horizontal: 'left' };
    });
  });

  // Congelar las primeras 3 filas (Título + Separador + Header)
  worksheet.views = [
    { state: 'frozen', xSplit: 0, ySplit: 3, activePane: 'bottomLeft' }
  ];

  // 5. Escribir y Guardar
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `${fileName}.xlsx`);
};

export default exportToExcel;
