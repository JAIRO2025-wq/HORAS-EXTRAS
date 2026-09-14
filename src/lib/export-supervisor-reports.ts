import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { SupervisorReport } from '@/lib/types';
import { format, parseISO, isValid } from 'date-fns';

/**
 * Exportador de Reportes de Jefes de Agencia.
 * Genera un Excel con:
 *  - Una hoja consolidada con todos los reportes.
 *  - Una hoja independiente por cada sucursal.
 */

// Orden oficial de sucursales
const BRANCH_ORDER = [
  'SAN MIGUEL',
  'MORAZAN',
  'USULUTAN',
  'SAN VICENTE',
  'CARA SUCIA',
  'SAN SALVADOR',
];

const HEADERS = [
  'SUCURSAL',
  'COLABORADOR',
  'PUESTO',
  'FECHA DE FALTA',
  'QUINCENA',
  'MOTIVO',
  'DETALLE',
  'REPORTADO POR',
  'FECHA DE REPORTE',
  'ESTADO',
  'NOTAS ADMINISTRACIÓN',
];

const COLUMN_WIDTHS = [
  { width: 18 }, // Sucursal
  { width: 35 }, // Colaborador
  { width: 22 }, // Puesto
  { width: 16 }, // Fecha de falta
  { width: 11 }, // Quincena
  { width: 30 }, // Motivo
  { width: 50 }, // Detalle
  { width: 32 }, // Reportado por
  { width: 20 }, // Fecha de reporte
  { width: 16 }, // Estado
  { width: 40 }, // Notas
];

const blueHeaderFill: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF0070C0' },
};
const whiteBoldFont: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true };
const borderStyle: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const date = parseISO(dateStr);
  return isValid(date) ? format(date, 'dd/MM/yyyy') : dateStr;
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const date = parseISO(dateStr);
  return isValid(date) ? format(date, 'dd/MM/yyyy HH:mm') : dateStr;
}

function statusText(status: string): string {
  if (status === 'reviewed') return 'REVISADO';
  if (status === 'dismissed') return 'DESCARTADO';
  return 'PENDIENTE';
}

/**
 * Ordena por sucursal (orden oficial) -> colaborador -> fecha de falta.
 */
function sortReports(reports: SupervisorReport[]): SupervisorReport[] {
  return [...reports].sort((a, b) => {
    const branchA = (a.branch || '').toUpperCase();
    const branchB = (b.branch || '').toUpperCase();

    const idxA = BRANCH_ORDER.indexOf(branchA);
    const idxB = BRANCH_ORDER.indexOf(branchB);
    const finalA = idxA === -1 ? 99 : idxA;
    const finalB = idxB === -1 ? 99 : idxB;

    if (finalA !== finalB) return finalA - finalB;
    if (branchA !== branchB) return branchA.localeCompare(branchB);

    const nameA = (a.employeeName || '').toUpperCase();
    const nameB = (b.employeeName || '').toUpperCase();
    if (nameA !== nameB) return nameA.localeCompare(nameB);

    return new Date(a.absenceDate).getTime() - new Date(b.absenceDate).getTime();
  });
}

/**
 * Construye una hoja con título, encabezados y filas de datos.
 */
function buildSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  title: string,
  reports: SupervisorReport[]
) {
  const worksheet = workbook.addWorksheet(sheetName);

  // 1. Título
  const titleRow = worksheet.addRow([title]);
  titleRow.font = { size: 14, bold: true, color: { argb: 'FF000000' } };
  worksheet.mergeCells(1, 1, 1, HEADERS.length);
  titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.addRow([]); // Fila de separación

  // 2. Encabezados
  const headerRow = worksheet.addRow(HEADERS);
  headerRow.height = 25;
  headerRow.eachCell((cell) => {
    cell.fill = blueHeaderFill;
    cell.font = whiteBoldFont;
    cell.border = borderStyle;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // 3. Anchos
  worksheet.columns = COLUMN_WIDTHS;

  // 4. Datos
  reports.forEach((r) => {
    const row = worksheet.addRow([
      (r.branch || 'N/A').toUpperCase(),
      r.employeeName || 'Sin Nombre',
      r.employeePosition || 'Colaborador',
      formatDate(r.absenceDate),
      `Q${r.quincena}`,
      r.reason || '',
      r.justification || '',
      r.supervisorName || '',
      formatDateTime(r.reportDate),
      statusText(r.status),
      r.adminNotes || '',
    ]);
    row.eachCell((cell) => {
      cell.border = borderStyle;
      cell.alignment = { vertical: 'middle', wrapText: true, horizontal: 'left' };
    });
  });

  // Congelar título + separador + encabezado
  worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];

  return worksheet;
}

/**
 * Sanitiza el nombre de una sucursal para usarlo como nombre de hoja de Excel.
 * Excel limita a 31 caracteres y prohíbe: \ / ? * [ ] :
 */
function sanitizeSheetName(name: string): string {
  return (name || 'SIN SUCURSAL')
    .replace(/[\\/?*[\]:]/g, '')
    .substring(0, 31)
    .toUpperCase();
}

const exportSupervisorReportsToExcel = async (
  data: SupervisorReport[],
  fileName: string
) => {
  const workbook = new ExcelJS.Workbook();
  const sorted = sortReports(data);

  // Hoja 1: Consolidado general
  buildSheet(
    workbook,
    'Consolidado',
    'REPORTE CONSOLIDADO DE INASISTENCIAS INFORMADAS POR JEFES DE AGENCIA',
    sorted
  );

  // Hojas siguientes: una por sucursal
  const branches = Array.from(new Set(sorted.map((r) => (r.branch || 'SIN SUCURSAL').toUpperCase())))
    .sort((a, b) => {
      const idxA = BRANCH_ORDER.indexOf(a);
      const idxB = BRANCH_ORDER.indexOf(b);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

  const usedNames = new Set<string>(['CONSOLIDADO']);

  for (const branch of branches) {
    const branchReports = sorted.filter(
      (r) => (r.branch || 'SIN SUCURSAL').toUpperCase() === branch
    );

    let sheetName = sanitizeSheetName(branch);
    // Evitar colisiones de nombre de hoja
    let suffix = 1;
    while (usedNames.has(sheetName)) {
      sheetName = sanitizeSheetName(`${branch}_${suffix}`);
      suffix++;
    }
    usedNames.add(sheetName);

    buildSheet(
      workbook,
      sheetName,
      `REPORTE DE INASISTENCIAS - ${branch}`,
      branchReports
    );
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `${fileName}.xlsx`);
};

export default exportSupervisorReportsToExcel;
