import type { Employee, OvertimeRecord } from '@/lib/types';
import { getOvertimeHoursFromRecord } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Genera el HTML del "Reporte de Horas Adicionales" (formato horizontal /
 * landscape) y lo abre en una ventana nueva. El usuario usa el diálogo nativo
 * del navegador para guardarlo como PDF vectorial: nítido y ligero.
 *
 * Diseño basado en el modelo aprobado (bento + matriz compacta).
 * Paginación: la primera hoja incluye KPIs, matriz, auditoría y firmas.
 * Si hay muchos registros, se generan hojas adicionales solo con la matriz.
 */

const RECORDS_FIRST_PAGE = 14;
const RECORDS_PER_PAGE = 22;

export function openOvertimeReportPdfWindow(
  employee: Employee,
  records: OvertimeRecord[],
  month: string,
  shareId?: string,
  quincenaFilter?: number | null
) {
  // Si se especifica una quincena, el reporte se limita a ella.
  const scoped = quincenaFilter
    ? records.filter(r => r.quincena === quincenaFilter)
    : records;

  // Se incluyen los registros aprobados y rechazados (los pendientes aún no
  // tienen dictamen, por lo que no forman parte del reporte oficial).
  const approved = scoped
    .filter(r => r.status === 'approved' || r.status === 'rejected')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Totales del período (solo aprobados: los rechazados no suman horas)
  let totalDay = 0;
  let totalNight = 0;
  let totalHours = 0;
  for (const r of approved) {
    if (r.status !== 'approved') continue;
    const h = getOvertimeHoursFromRecord(r);
    totalDay += h.dayHours;
    totalNight += h.nightHours;
    totalHours += r.totalHours ?? 0;
  }

  const approvedCount = approved.filter(r => r.status === 'approved').length;
  const rejectedCount = approved.filter(r => r.status === 'rejected').length;

  const additionalDays = approved.filter(r => r.type === 'additional_day' && r.status === 'approved').length;
  const quincenas = Array.from(new Set(approved.map(r => r.quincena).filter(Boolean))).sort();
  const quincenaLabel = quincenas.length === 1
    ? `Q${quincenas[0]} (${quincenas[0] === 1 ? 'Primera' : 'Segunda'} Quincena)`
    : quincenas.length > 1
      ? quincenas.map(q => `Q${q}`).join(' y ')
      : 'Sin registros';

  const ref = (approved[0]?.id || 'sin-registros').substring(0, 8).toLowerCase();
  const uuid = approved[0]?.id || 'sin-registros';
  const fechaEmision = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });

  // URL pública de consulta (se resuelve con el origen real en la ventana).
  const shareUrl = shareId ? `/r/${shareId}` : '';

  // Paginación de la matriz
  const pages: OvertimeRecord[][] = [];
  const rest = [...approved];
  pages.push(rest.splice(0, RECORDS_FIRST_PAGE));
  while (rest.length > 0) pages.push(rest.splice(0, RECORDS_PER_PAGE));
  if (pages.length === 0) pages.push([]);

  const totalPages = pages.length;

  const renderRows = (rows: OvertimeRecord[], startIndex: number) => rows.map((r, i) => {
    const h = getOvertimeHoursFromRecord(r);
    const dateObj = new Date(r.date);
    const dayName = format(dateObj, 'EEE', { locale: es });
    const isAdditional = r.type === 'additional_day';
    const companions = (r as any).companions || (r as any).colleagues || '';
    const isRejected = r.status === 'rejected';
    const statusLabel = isRejected ? 'Rechazado' : 'Aprobado';
    const statusClass = isRejected
      ? 'bg-rose-100 text-rose-800'
      : 'bg-emerald-100 text-emerald-800';
    const rowClass = isRejected ? 'bg-rose-50/40' : 'hover:bg-slate-50/80';

    return `
      <tr class="${rowClass} transition-colors">
        <td class="py-1 px-2.5 border-r border-slate-200 text-center font-bold text-slate-400">${startIndex + i + 1}</td>
        <td class="py-1 px-2.5 border-r border-slate-200 font-medium whitespace-nowrap text-slate-800">
          ${format(dateObj, 'dd/MM/yyyy')} <span class="text-[9px] text-slate-400">(${dayName.charAt(0).toUpperCase() + dayName.slice(1)})</span>
        </td>
        <td class="py-1 px-2.5 border-r border-slate-200 text-center whitespace-nowrap font-mono text-[10px]">
          <span class="text-slate-700 font-semibold">${escapeHtml(r.startTime || '--')}</span> → <span class="text-slate-700 font-semibold">${escapeHtml(r.endTime || '--')}</span>
        </td>
        <td class="py-1 px-2.5 border-r border-slate-200 text-center font-extrabold ${isRejected ? 'text-slate-400 line-through' : 'text-sky-900 bg-sky-50/40'}">${(r.totalHours ?? 0).toFixed(1)} h</td>
        <td class="py-1 px-2.5 border-r border-slate-200 text-center font-bold ${isRejected ? 'text-slate-400' : 'text-amber-900'}">${h.dayHours.toFixed(1)} h</td>
        <td class="py-1 px-2.5 border-r border-slate-200 text-center font-bold ${isRejected ? 'text-slate-400' : 'text-indigo-900'}">${h.nightHours.toFixed(1)} h</td>
        <td class="py-1 px-2.5 border-r border-slate-200 whitespace-nowrap">
          <span style="font-size:10px;background-color:rgb(241,245,249);padding:1px 4px;border-radius:3px;" class="font-bold text-slate-700">${isAdditional ? 'Día Adicional' : 'Hora Extra'}</span>
        </td>
        <td class="py-1 px-2.5 border-r border-slate-200 font-semibold text-slate-800 max-w-[200px] truncate" title="${escapeHtml(r.activity || '')}">${escapeHtml(r.activity || '--')}</td>
        <td class="py-1 px-2.5 border-r border-slate-200 text-slate-400 italic text-[10px] text-center">${companions ? escapeHtml(companions) : '(Sin acompañantes)'}</td>
        <td class="py-1 px-2.5 border-r border-slate-200 text-center">
          <span style="font-size:9px;padding:1px 6px;border-radius:999px;" class="font-bold uppercase ${statusClass}">${statusLabel}</span>
        </td>
      </tr>`;
  }).join('');

  const renderMatrix = (rows: OvertimeRecord[], startIndex: number, pageNum: number) => `
    <div class="border border-slate-200 rounded-md overflow-hidden mb-2 bg-white">
      <div class="bg-slate-100/90 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 bg-[#0080c8] rounded-full"></span>
          <h2 class="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Matriz Normalizada de Horas Extras y Jornadas Adicionales</h2>
        </div>
        <span class="text-[10px] text-slate-500 font-medium">${approved.length} Registro${approved.length === 1 ? '' : 's'} Total${approved.length === 1 ? '' : 'es'} • Hoja ${pageNum} de ${totalPages}</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 text-[10px] uppercase font-bold tracking-wider">
              <th class="py-1 px-2.5 border-r border-slate-200 text-center w-8">#</th>
              <th class="py-1 px-2.5 border-r border-slate-200">Fecha</th>
              <th class="py-1 px-2.5 border-r border-slate-200 text-center">Horario</th>
              <th class="py-1 px-2.5 border-r border-slate-200 text-center">Total</th>
              <th class="py-1 px-2.5 border-r border-slate-200 text-center">Diurnas</th>
              <th class="py-1 px-2.5 border-r border-slate-200 text-center">Nocturnas</th>
              <th class="py-1 px-2.5 border-r border-slate-200">Tipo</th>
              <th class="py-1 px-2.5 border-r border-slate-200">Actividad Realizada</th>
              <th class="py-1 px-2.5 border-r border-slate-200">Compañeros</th>
              <th class="py-1 px-2.5 border-r border-slate-200 text-center">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${rows.length > 0 ? renderRows(rows, startIndex) : `<tr><td colspan="10" class="py-6 text-center text-slate-400 italic text-[11px]">Sin registros aprobados ni rechazados en el período.</td></tr>`}
          </tbody>
          ${pageNum === totalPages ? `
          <tfoot>
            <tr class="bg-slate-100/90 font-bold text-slate-900 border-t-2 border-slate-300">
              <td colspan="3" class="py-1 px-2.5 text-right uppercase text-[10px] tracking-wider text-slate-600 border-r border-slate-200">Total Acumulado del Período:</td>
              <td class="py-1 px-2.5 text-center text-sky-900 font-black border-r border-slate-200 bg-sky-100/60">${totalHours.toFixed(1)} hrs</td>
              <td class="py-1 px-2.5 text-center text-amber-900 font-bold border-r border-slate-200">${totalDay.toFixed(1)} hr</td>
              <td class="py-1 px-2.5 text-center text-indigo-900 font-bold border-r border-slate-200">${totalNight.toFixed(1)} hrs</td>
              <td colspan="4" class="py-1 px-2.5 text-slate-500 text-[10px] font-normal italic">Cálculo conforme al Código de Trabajo y política interna de remuneración de horas extraordinarias.</td>
            </tr>
          </tfoot>` : ''}
        </table>
      </div>
    </div>`;

  const kpiBlock = `
    <div class="kpi-grid grid grid-cols-1 gap-2 mb-2.5">
      <div class="kpi-employee bg-slate-50 border border-slate-200/90 rounded-md p-2 flex items-center justify-between">
        <div>
          <div class="text-[9px] uppercase font-bold tracking-wider text-slate-500">Colaborador / Empleado</div>
          <div class="text-[11px] font-black text-slate-900 leading-tight uppercase">${escapeHtml(employee.name)}</div>
          <div class="text-[9px] text-slate-500 mt-0.5">Quincena: <strong class="text-slate-700">${quincenaLabel}</strong> • Sucursal: <span class="font-semibold text-slate-700">${escapeHtml(employee.branch || '--')}</span></div>
        </div>
        <div class="flex items-center gap-4">
          <div class="text-right">
            <div class="text-[9px] uppercase font-bold tracking-wider text-slate-500">Total Horas</div>
            <div class="text-sm font-black text-sky-950">${totalHours.toFixed(2)} <span class="text-[9px] font-semibold text-sky-700">horas reg.</span></div>
          </div>
          <div class="text-right">
            <div class="text-[9px] uppercase font-bold tracking-wider text-slate-500">Distribución Jornada</div>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-200/80 text-amber-900">Diurna: ${totalDay.toFixed(1)}h</span>
              <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-900">Nocturna: ${totalNight.toFixed(1)}h</span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-[9px] uppercase font-bold tracking-wider text-slate-500">Dictamen RRHH</div>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="flex items-center gap-1 text-emerald-800 font-black text-xs uppercase">
                <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                <span>${approvedCount} Aprobado${approvedCount === 1 ? '' : 's'}</span>
              </span>
              ${rejectedCount > 0 ? `
              <span class="flex items-center gap-1 text-rose-800 font-black text-xs uppercase">
                <svg class="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                <span>${rejectedCount} Rechazado${rejectedCount === 1 ? '' : 's'}</span>
              </span>` : ''}
            </div>
          </div>
          <span class="px-2 py-0.5 text-[9px] font-bold rounded bg-slate-200 text-slate-700 uppercase">${employee.status === 'active' ? 'Activo' : 'Inactivo'}</span>
        </div>
      </div>
    </div>`;

  const auditBlock = `
    <div class="audit-grid grid grid-cols-1 md:grid-cols-12 gap-2 mb-2">
      <div class="audit-left md:col-span-5 bg-slate-50/80 border border-slate-200 rounded-md p-2 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between border-b border-slate-200 pb-1 mb-1.5">
            <span class="text-[9px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
              <svg class="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
              Trazabilidad y Auditoría de Registro Digital
            </span>
            <span class="text-[8px] font-mono text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-semibold">Integridad Verificada</span>
          </div>
          <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
            <div>
              <span class="text-slate-400 block text-[9px] uppercase">Registro en Sistema:</span>
              <span class="font-mono text-slate-800 font-semibold">${approved[0]?.createdAt ? format(new Date(approved[0].createdAt), 'dd/MM/yyyy HH:mm') : '--'}</span>
            </div>
            <div>
              <span class="text-slate-400 block text-[9px] uppercase">Identificador Único:</span>
              <span class="font-mono text-slate-800 text-[9px] truncate block" title="${uuid}">${uuid.substring(0, 8)}...${uuid.substring(uuid.length - 12)}</span>
            </div>
            <div class="col-span-2">
              <span class="text-slate-400 block text-[9px] uppercase">Notas de Administración:</span>
              <span class="text-slate-500 italic text-[10px]">${escapeHtml(approved[0]?.adminNotes || 'Sin observaciones adicionales registradas.')}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="audit-right md:col-span-7 bg-white border border-slate-200 rounded-md p-2">
        <div class="text-[9px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-1 mb-1.5 flex items-center justify-between">
          <span>Cadena de Firmas y Validación Ejecutiva</span>
          <span class="text-[8px] text-slate-400">Resolución Oficial de Planilla</span>
        </div>
        <div class="sign-grid grid grid-cols-3 gap-2 text-center">
          <div class="border border-slate-200 rounded p-1.5 bg-slate-50/50 flex flex-col justify-between h-[76px]">
            <div class="text-[8px] text-slate-400 uppercase italic">Conformidad del Colaborador</div>
            <div class="my-auto font-semibold text-slate-800 text-[10px] leading-tight">${escapeHtml(employee.name)}</div>
            <div class="border-t border-slate-300 pt-0.5 text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Firma del Solicitante</div>
          </div>
          <div class="border border-slate-200 rounded p-1.5 bg-slate-50/50 flex flex-col justify-between h-[76px]">
            <div class="text-[8px] text-emerald-600 uppercase font-semibold">Visto Bueno Digital</div>
            <div class="my-auto">
              <div class="text-[9px] font-bold text-slate-800 leading-tight">JEFATURA INMEDIATA</div>
              <div class="text-[8px] text-slate-400 font-mono">${approved[0]?.approvedAt ? format(new Date(approved[0].approvedAt), 'dd/MM/yyyy HH:mm') : '--'}</div>
            </div>
            <div class="border-t border-slate-300 pt-0.5 text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Jefatura Inmediata</div>
          </div>
          <div class="border border-emerald-300 rounded p-1.5 bg-emerald-50/30 flex flex-col justify-between h-[76px]">
            <div class="text-[8px] text-emerald-700 font-bold uppercase bg-emerald-100/80 rounded px-1 py-0.5 inline-block mx-auto">Sello Aprobado RRHH</div>
            <div class="my-auto">
              <div class="text-[9px] font-black text-slate-900 leading-tight">${escapeHtml(approved[0]?.approvedBy || 'DEPTO. TALENTO HUMANO')}</div>
              <div class="text-[8px] text-emerald-700 font-mono font-semibold">APROBACIÓN NÓMINA</div>
            </div>
            <div class="border-t border-emerald-300 pt-0.5 text-[8px] font-bold text-emerald-900 uppercase tracking-tighter">Resolución RRHH</div>
          </div>
        </div>
      </div>
    </div>`;

  const qrBlock = shareId ? `
    <div class="qr-block flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-md p-2 mb-2">
      <div class="flex items-center gap-3">
        <div class="qr-holder bg-white border border-slate-300 rounded p-1.5 flex-shrink-0" style="width:100px;height:100px;">
          <div id="qr-canvas" style="width:88px;height:88px;"></div>
        </div>
        <div>
          <div class="text-[10px] font-bold uppercase tracking-wider text-slate-700">Consulta digital del colaborador</div>
          <div class="text-[9px] text-slate-600 mt-0.5 max-w-[440px] leading-snug">
            Estimado colaborador: su reporte de horas adicionales del período <strong>${escapeHtml(month)}</strong>
            (${escapeHtml(quincenaLabel)}) está disponible en línea. Escanee el código QR o abra el enlace
            para consultarlo desde su teléfono en cualquier momento.
          </div>
          <div class="mt-1 flex items-center gap-1.5">
            <span class="text-[9px] font-bold uppercase tracking-wider text-slate-500">Enlace:</span>
            <a href="${escapeHtml(shareUrl)}" target="_blank" class="text-[9px] font-mono text-[#0080c8] underline break-all" id="qr-link-text">${escapeHtml(shareUrl)}</a>
          </div>
        </div>
      </div>
      <button onclick="copyQrImage()" class="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0080c8] hover:bg-[#006ba6] text-white font-semibold text-[11px] transition-colors shadow-sm active:scale-95 cursor-pointer flex-shrink-0">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
        <span id="qr-copy-label">Copiar enlace</span>
      </button>
    </div>` : '';

  const headerBlock = (pageNum: number) => `
    <div class="flex items-center justify-between pb-2 mb-2 border-b-2 border-slate-800">
      <div class="flex items-center gap-2.5">
        <div class="w-9 h-9 rounded-lg bg-[#0080c8] flex items-center justify-center text-white shadow-sm flex-shrink-0">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
        </div>
        <div>
          <h1 class="text-sm font-extrabold tracking-tight text-[#0a2540] uppercase leading-tight">Flynet Business System</h1>
          <p class="text-[10px] font-semibold text-[#0080c8] uppercase tracking-wider">Departamento de Recursos Humanos • Gestión de Talento y Nómina</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="text-right hidden sm:block">
          <div class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fecha de Emisión</div>
          <div class="text-[11px] font-bold text-slate-700">${fechaEmision}</div>
        </div>
        <div class="bg-[#0a2540] text-white px-3 py-1.5 rounded-md text-right">
          <span class="block text-[8px] font-semibold tracking-widest uppercase text-sky-200">Tipo de Documento</span>
          <span class="text-xs font-black uppercase tracking-wide">Reporte de Horas Adicionales</span>
        </div>
        <div class="bg-slate-100 border border-slate-300 px-2.5 py-1.5 rounded-md text-center">
          <span class="block text-[8px] font-semibold uppercase text-slate-500">ID Ref</span>
          <span class="text-[10px] font-mono font-bold text-slate-800">${ref}</span>
        </div>
      </div>
    </div>`;

  const footerBlock = (pageNum: number) => `
    <footer class="pt-1.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[9px] text-slate-500">
      <div class="flex items-center gap-3">
        <span>DOCUMENTO OFICIAL GENERADO POR <strong>FLYNET BUSINESS SYSTEM</strong></span>
        <span>•</span>
        <span class="font-mono">UUID: ${uuid}</span>
        <span>•</span>
        <span>AUTENTICACIÓN SHA-256</span>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex items-end gap-[1.5px] h-3.5 px-1 bg-white border border-slate-200 rounded">
          <span class="w-[2px] h-3.5 bg-slate-800"></span><span class="w-[1px] h-3.5 bg-slate-800"></span><span class="w-[3px] h-3.5 bg-slate-800"></span><span class="w-[1px] h-3.5 bg-slate-800"></span><span class="w-[2px] h-3.5 bg-slate-800"></span><span class="w-[4px] h-3.5 bg-slate-800"></span><span class="w-[1px] h-3.5 bg-slate-800"></span><span class="w-[2px] h-3.5 bg-slate-800"></span><span class="w-[1px] h-3.5 bg-slate-800"></span><span class="w-[3px] h-3.5 bg-slate-800"></span><span class="w-[2px] h-3.5 bg-slate-800"></span>
        </div>
        <span class="font-semibold text-slate-600">Pág. ${pageNum} de ${totalPages}</span>
      </div>
    </footer>`;

  // Construye cada hoja
  let startIndex = 0;
  const sheets = pages.map((rows, i) => {
    const pageNum = i + 1;
    const isFirst = i === 0;
    const isLast = i === totalPages - 1;
    const sheet = `
      <main class="page-sheet w-full max-w-[1320px] bg-white rounded-lg shadow-md border border-slate-200 p-3 sm:p-4 text-slate-800">
        ${headerBlock(pageNum)}
        ${isFirst ? kpiBlock : ''}
        ${renderMatrix(rows, startIndex, pageNum)}
        ${isLast ? auditBlock : ''}
        ${isLast ? qrBlock : ''}
        ${footerBlock(pageNum)}
      </main>`;
    startIndex += rows.length;
    return sheet;
  }).join('');

  // Datos normalizados para la exportación a Excel (mismos registros aprobados)
  const excelRows = approved.map((r, i) => {
    const h = getOvertimeHoursFromRecord(r);
    const dateObj = new Date(r.date);
    const companions = (r as any).companions || (r as any).colleagues || '';
    return {
      'N°': i + 1,
      'Fecha': format(dateObj, 'dd/MM/yyyy'),
      'Colaborador': employee.name,
      'Hora Inicio': r.startTime || '--',
      'Hora Fin': r.endTime || '--',
      'Actividad Realizada': r.activity || '--',
      'Compañeros': companions || '(Sin acompañantes)',
      'Quincena': `Q${r.quincena}`,
      'Total Horas': Number((r.totalHours ?? 0).toFixed(2)),
      'Horas Diurnas': Number(h.dayHours.toFixed(2)),
      'Horas Nocturnas': Number(h.nightHours.toFixed(2)),
      'Tipo': r.type === 'additional_day' ? 'Día Adicional' : 'Hora Extra',
      'Estado': r.status === 'approved' ? 'Aprobado' : r.status === 'rejected' ? 'Rechazado' : 'Pendiente',
      'Notas Admin': r.adminNotes || '',
      'Aprobado Por': r.approvedBy || '',
      'Fecha Aprobación': r.approvedAt ? format(new Date(r.approvedAt), 'dd/MM/yyyy HH:mm') : ''
    };
  });

  const excelFileName = `Reporte_Horas_Extras_${employee.name.replace(/[^a-zA-Z0-9]/g, '_')}_${month}${quincenas.length === 1 ? `_Q${quincenas[0]}` : ''}.xlsx`;

  // Metadatos que se muestran en el encabezado del Excel exportado.
  const excelMeta = {
    employeeName: employee.name,
    branch: employee.branch || '--',
    month,
    quincena: quincenaLabel,
    emittedAt: fechaEmision,
    ref: ref.toUpperCase(),
    totalHours: Number(totalHours.toFixed(2)),
    totalDay: Number(totalDay.toFixed(2)),
    totalNight: Number(totalNight.toFixed(2)),
  };

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Reporte de Horas Adicionales - ${escapeHtml(employee.name)} | Flynet Business System</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background-color: #f1f5f9;
    color: #0f172a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .font-mono-code { font-family: 'JetBrains Mono', monospace; }
  @page { size: letter landscape; margin: 6mm 8mm; }
  @media print {
    html, body { background:#ffffff !important; padding:0 !important; margin:0 !important; display:block !important; }
    .no-print { display:none !important; }
    .page-sheet {
      box-sizing:border-box !important;
      max-width:100% !important;
      width:100% !important;
      padding:0 !important;
      margin:0 !important;
      box-shadow:none !important;
      border:none !important;
      border-radius:0 !important;
      page-break-inside:avoid !important;
      break-inside:avoid !important;
    }
    .page-sheet + .page-sheet { page-break-before:always !important; break-before:page !important; }
    /* Fuerza el layout de escritorio al imprimir: los breakpoints
       de Tailwind se basan en el ancho del viewport, no del papel. */
    .kpi-grid { display:grid !important; grid-template-columns:1fr !important; }
    .sign-grid { display:grid !important; grid-template-columns:repeat(3, minmax(0, 1fr)) !important; }
    .audit-grid { display:grid !important; grid-template-columns:repeat(12, minmax(0, 1fr)) !important; }
    .audit-grid > .audit-left { grid-column:span 5 / span 5 !important; }
    .audit-grid > .audit-right { grid-column:span 7 / span 7 !important; }
    .qr-block { display:flex !important; align-items:center !important; justify-content:space-between !important; }
  }
</style>
</head>
<body class="p-3 md:p-5 flex flex-col items-center justify-start min-h-screen text-slate-800 antialiased text-xs print:block print:p-0">

  <header class="w-full max-w-[1320px] mb-3 flex flex-wrap items-center justify-between gap-3 bg-white/95 backdrop-blur px-4 py-2 rounded-xl shadow-sm border border-slate-200/80 no-print">
    <div class="flex items-center gap-2">
      <div class="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold text-[11px]">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        SISTEMA RRHH ACTIVO • REPORTE HORIZONTAL
      </div>
      <span class="text-slate-400">|</span>
      <span class="text-slate-600 font-medium text-[11px]">${approved.length} registro${approved.length === 1 ? '' : 's'} aprobado${approved.length === 1 ? '' : 's'} • ${totalPages} hoja${totalPages === 1 ? '' : 's'}</span>
    </div>
    <div class="flex items-center gap-2">
      <button onclick="exportToExcel()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition-colors shadow-sm active:scale-95 cursor-pointer">
        <svg class="w-4 h-4 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        <span>Exportar a Excel (.xlsx)</span>
      </button>
      <button onclick="window.print()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0a2540] hover:bg-[#071a2d] text-white font-semibold text-xs transition-colors shadow-sm active:scale-95 cursor-pointer">
        <svg class="w-4 h-4 text-sky-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
        <span>Imprimir / Guardar en PDF</span>
      </button>
    </div>
  </header>

  ${sheets}

  <div id="copy-toast" class="no-print" style="position:fixed;left:50%;bottom:24px;transform:translate(-50%,12px);opacity:0;transition:opacity .25s ease, transform .25s ease;background:#0a2540;color:#fff;font-size:12px;font-weight:600;padding:10px 18px;border-radius:10px;box-shadow:0 8px 24px rgba(10,37,64,.35);z-index:9999;pointer-events:none;"></div>

<script>
  var EXCEL_ROWS = ${JSON.stringify(excelRows)};
  var EXCEL_FILE = ${JSON.stringify(excelFileName)};
  var SHARE_URL = ${JSON.stringify(shareId ? `/r/${shareId}` : '')};
  var META = ${JSON.stringify(excelMeta)};

  function exportToExcel() {
    if (typeof XLSX === 'undefined') {
      alert('No se pudo cargar el generador de Excel. Verifica tu conexión a internet e inténtalo de nuevo.');
      return;
    }

    var HEADERS = [
      'N°', 'Fecha', 'Colaborador', 'Hora Inicio', 'Hora Fin', 'Actividad Realizada',
      'Compañeros', 'Quincena', 'Total Horas', 'Horas Diurnas', 'Horas Nocturnas',
      'Tipo', 'Estado', 'Notas Admin', 'Aprobado Por', 'Fecha Aprobación'
    ];

    // Matriz: fila de título + fila de metadatos + encabezados + datos + totales
    var aoa = [];
    aoa.push(['REPORTE DE HORAS ADICIONALES']);
    aoa.push(['Colaborador:', META.employeeName, '', 'Período:', META.month, '', 'Quincena:', META.quincena]);
    aoa.push(['Sucursal:', META.branch, '', 'Emitido:', META.emittedAt, '', 'Ref:', META.ref]);
    aoa.push([]);
    aoa.push(HEADERS);

    EXCEL_ROWS.forEach(function (r) {
      aoa.push(HEADERS.map(function (h) { return r[h]; }));
    });

    var firstDataRow = 6; // fila 1-indexed donde inician los datos
    var lastDataRow = firstDataRow + EXCEL_ROWS.length - 1;
    aoa.push([]);
    aoa.push(['', '', '', '', '', '', '', 'TOTALES',
      META.totalHours, META.totalDay, META.totalNight, '', '', '', '', '']);

    var ws = XLSX.utils.aoa_to_sheet(aoa);

    // Anchos de columna
    ws['!cols'] = [
      { wch: 6 }, { wch: 12 }, { wch: 32 }, { wch: 11 }, { wch: 11 },
      { wch: 44 }, { wch: 24 }, { wch: 10 }, { wch: 11 }, { wch: 13 },
      { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 18 }
    ];

    // Alturas de fila
    ws['!rows'] = [{ hpt: 26 }, { hpt: 18 }, { hpt: 18 }, { hpt: 6 }, { hpt: 22 }];

    // Estilo: título
    var titleCell = ws['A1'];
    if (titleCell) {
      titleCell.s = {
        font: { bold: true, sz: 14, color: { rgb: 'FFFFFFFF' } },
        fill: { fgColor: { rgb: 'FF0A2540' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }
    // Combinar el título en toda la fila
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: HEADERS.length - 1 } }];

    // Estilo: metadatos (filas 2 y 3)
    for (var mr = 1; mr <= 2; mr++) {
      for (var mc = 0; mc < HEADERS.length; mc++) {
        var mcell = ws[XLSX.utils.encode_cell({ r: mr, c: mc })];
        if (!mcell) continue;
        mcell.s = {
          font: { bold: mc % 3 === 0, sz: 10, color: { rgb: 'FF334155' } },
          fill: { fgColor: { rgb: 'FFF1F5F9' } },
          alignment: { vertical: 'center' }
        };
      }
    }

    // Estilo: encabezados (fila 5)
    for (var hc = 0; hc < HEADERS.length; hc++) {
      var hcell = ws[XLSX.utils.encode_cell({ r: 4, c: hc })];
      if (!hcell) continue;
      hcell.s = {
        font: { bold: true, sz: 10, color: { rgb: 'FFFFFFFF' } },
        fill: { fgColor: { rgb: 'FF0070C0' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: 'FF94A3B8' } },
          bottom: { style: 'thin', color: { rgb: 'FF94A3B8' } },
          left: { style: 'thin', color: { rgb: 'FF94A3B8' } },
          right: { style: 'thin', color: { rgb: 'FF94A3B8' } }
        }
      };
    }

    // Estilo: datos
    for (var r = firstDataRow - 1; r <= lastDataRow - 1; r++) {
      var isEven = (r - (firstDataRow - 1)) % 2 === 1;
      for (var c = 0; c < HEADERS.length; c++) {
        var cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
        if (!cell) continue;
        var isNumeric = c >= 8 && c <= 10;
        cell.s = {
          font: { sz: 10, bold: isNumeric, color: { rgb: isNumeric ? 'FF0C4A6E' : 'FF1E293B' } },
          fill: { fgColor: { rgb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' } },
          alignment: {
            horizontal: isNumeric ? 'right' : (c === 0 || c === 7 || c === 12 ? 'center' : 'left'),
            vertical: 'center',
            wrapText: c === 5 || c === 13
          },
          border: {
            top: { style: 'thin', color: { rgb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { rgb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { rgb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { rgb: 'FFE2E8F0' } }
          }
        };
        if (isNumeric) cell.z = '0.00';
      }
    }

    // Estilo: fila de totales
    var totalRowIdx = lastDataRow + 1;
    for (var tc = 0; tc < HEADERS.length; tc++) {
      var tcell = ws[XLSX.utils.encode_cell({ r: totalRowIdx, c: tc })];
      if (!tcell) continue;
      var isTotalNumeric = tc >= 8 && tc <= 10;
      tcell.s = {
        font: { bold: true, sz: 10, color: { rgb: 'FF0F172A' } },
        fill: { fgColor: { rgb: 'FFE2E8F0' } },
        alignment: { horizontal: isTotalNumeric ? 'right' : 'right', vertical: 'center' },
        border: {
          top: { style: 'medium', color: { rgb: 'FF94A3B8' } },
          bottom: { style: 'thin', color: { rgb: 'FF94A3B8' } },
          left: { style: 'thin', color: { rgb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { rgb: 'FFE2E8F0' } }
        }
      };
      if (isTotalNumeric) tcell.z = '0.00';
    }

    // Congelar encabezados y autofiltro
    ws['!freeze'] = { xSplit: 0, ySplit: 5 };
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({ s: { r: 4, c: 0 }, e: { r: lastDataRow - 1, c: HEADERS.length - 1 } })
    };

    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Horas Extras');
    XLSX.writeFile(wb, EXCEL_FILE, { cellStyles: true });
  }

  // Genera el QR apuntando a la vista web del reporte.
  (function renderQr() {
    var holder = document.getElementById('qr-canvas');
    if (!holder || !SHARE_URL) return;
    var url = window.location.origin + SHARE_URL;
    if (typeof QRCode === 'undefined') {
      holder.innerHTML = '<div style="font-size:9px;color:#94a3b8;padding:8px;text-align:center">QR no disponible</div>';
      return;
    }
    try {
      new QRCode(holder, {
        text: url,
        width: 88,
        height: 88,
        colorDark: '#0f172a',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      holder.innerHTML = '<div style="font-size:9px;color:#94a3b8;padding:8px;text-align:center">QR no disponible</div>';
    }
  })();

  // Copia el mensaje con el enlace de consulta del reporte.
  function copyQrImage() {
    var fullUrl = window.location.origin + SHARE_URL;
    var message =
      'Estimado colaborador: su reporte de horas adicionales del período ' + META.month +
      ' (' + META.quincena + ') ya está disponible. Puede consultarlo en línea aquí: ' + fullUrl;

    console.log('[Reporte HE] Copiando enlace:', message);

    // Limpia el portapapeles de cualquier imagen previa escribiendo solo texto.
    var onSuccess = function () {
      console.log('[Reporte HE] Enlace copiado correctamente.');
      showToast('Enlace copiado al portapapeles');
    };
    var onError = function (err) {
      console.warn('[Reporte HE] Falló clipboard API, usando respaldo:', err);
      fallbackCopy(message, onSuccess);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(message).then(onSuccess).catch(onError);
      return;
    }
    fallbackCopy(message, onSuccess);
  }

  // Respaldo para navegadores sin API de portapapeles (o sin HTTPS).
  function fallbackCopy(text, onSuccess) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    if (ok) {
      onSuccess();
    } else {
      alert('No se pudo copiar automáticamente. Copia el enlace manualmente:\\n\\n' + text);
    }
  }

  // Aviso flotante de confirmación.
  function showToast(msg) {
    var toast = document.getElementById('copy-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, 0)';
    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, 12px)';
    }, 2600);
  }
<\/script>

</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('El navegador bloqueó la ventana emergente. Permite las ventanas emergentes para generar el PDF.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/** Escapa caracteres HTML para evitar inyección en el documento generado. */
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
