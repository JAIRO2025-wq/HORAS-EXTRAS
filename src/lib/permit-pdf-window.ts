import { PermitRequest } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Genera el HTML del documento oficial "Acción de Personal" y lo abre en una
 * ventana nueva. El usuario usa el diálogo nativo del navegador (Ctrl+P /
 * botón Imprimir) para guardarlo como PDF vectorial: nítido y ligero.
 *
 * Página 1: documento oficial (diseño bento grid).
 * Página 2: evidencia adjunta (si existe).
 */
export function openPermitPdfWindow(permit: PermitRequest) {
  const isInasistencia = permit.action === 'INASISTENCIA';
  const isApproved = permit.status === 'approved';
  const isRejected = permit.status === 'rejected';

  const dictamen = isApproved
    ? 'AUTORIZADO / APROBADO'
    : isRejected
      ? 'DENEGADO / RECHAZADO'
      : permit.status === 'pending_admin'
        ? 'PENDIENTE DE FIRMA GERENCIAL'
        : 'EN TRÁMITE';

  const ref = permit.id.substring(0, 8).toUpperCase();
  const hash = permit.id.replace(/-/g, '').substring(0, 16);

  const hasEvidence = !!permit.evidenceFileDataUri;
  const evidenceIsImage = !!permit.evidenceFileDataUri?.includes('type=image');

  const periodo = permit.startDate === permit.endDate
    ? format(parseISO(permit.startDate), 'dd/MM/yyyy')
    : `Del ${format(parseISO(permit.startDate), 'dd/MM/yyyy')} al ${format(parseISO(permit.endDate), 'dd/MM/yyyy')}`;

  const naturaleza = isInasistencia
    ? `FALTA: ${permit.eventuality || 'INASISTENCIA'}`
    : permit.action;

  const fechaEmision = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });

  // Colores según el estado del dictamen
  const tone = isApproved
    ? { grad: 'from-emerald-50/70 via-emerald-50/30 to-white', border: 'border-emerald-200/90', chipBorder: 'border-emerald-300', chipText: 'text-emerald-800', dot: 'bg-emerald-500', circle: 'bg-emerald-600 ring-emerald-100', label: 'text-emerald-800', value: 'text-emerald-700', noteBorder: 'border-emerald-200/60', noteBg: 'bg-emerald-50/50', noteText: 'text-emerald-900', seal: 'text-emerald-700 bg-emerald-50 border-emerald-200', sealLabel: 'Sello de Aprobación RRHH', chipLabel: 'Resolución Favorable' }
    : isRejected
      ? { grad: 'from-red-50/70 via-red-50/30 to-white', border: 'border-red-200/90', chipBorder: 'border-red-300', chipText: 'text-red-800', dot: 'bg-red-500', circle: 'bg-red-600 ring-red-100', label: 'text-red-800', value: 'text-red-700', noteBorder: 'border-red-200/60', noteBg: 'bg-red-50/50', noteText: 'text-red-900', seal: 'text-red-700 bg-red-50 border-red-200', sealLabel: 'Sello de Rechazo RRHH', chipLabel: 'Resolución Desfavorable' }
      : { grad: 'from-amber-50/70 via-amber-50/30 to-white', border: 'border-amber-200/90', chipBorder: 'border-amber-300', chipText: 'text-amber-800', dot: 'bg-amber-500', circle: 'bg-amber-500 ring-amber-100', label: 'text-amber-800', value: 'text-amber-700', noteBorder: 'border-amber-200/60', noteBg: 'bg-amber-50/50', noteText: 'text-amber-900', seal: 'text-amber-700 bg-amber-50 border-amber-200', sealLabel: 'Sello RRHH', chipLabel: 'En Trámite' };

  const checkIcon = `<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
  const crossIcon = `<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Acción de Personal - REF: ${ref} | Flynet Business System</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"><\/script>
<link href="https://fonts.googleapis.com" rel="preconnect" />
<link crossorigin href="https://fonts.gstatic.com" rel="preconnect" />
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,500&display=swap" rel="stylesheet" />
<script>
  tailwind.config = {
    theme: {
      extend: {
        fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'] },
        colors: {
          brand: { 50:'#f0f7ff',100:'#e0effe',500:'#0284c7',700:'#0369a1',800:'#075985',900:'#0c4a6e',primary:'#0f3d64' }
        },
        boxShadow: {
          'sheet': '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
          'bento': '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)'
        }
      }
    }
  }
<\/script>
<style data-purpose="document-print-rules">
  @media print {
    html, body { background:#ffffff !important; margin:0 !important; padding:0 !important; display:block !important; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
    .no-print { display:none !important; }
    /* Cada hoja ocupa exactamente una página carta. El padding va DENTRO del
       alto de la hoja (box-sizing:border-box) para que no desborde a una 2ª. */
    .page-sheet {
      box-sizing:border-box !important;
      width:100% !important;
      max-width:100% !important;
      height:279mm !important;
      min-height:0 !important;
      margin:0 !important;
      padding:1.4cm 1.8cm 1.2cm 1.8cm !important;
      box-shadow:none !important;
      border:none !important;
      border-radius:0 !important;
      overflow:hidden !important;
      page-break-inside:avoid !important;
      break-inside:avoid !important;
    }
    /* Solo se fuerza salto de página ENTRE hojas, nunca después de la última. */
    .page-sheet + .page-sheet { page-break-before:always !important; break-before:page !important; }
    @page { size: letter portrait; margin: 0; }
  }
<\/style>
</head>
<body class="bg-slate-100 text-slate-800 font-sans antialiased min-h-screen py-8 print:py-0 print:bg-white flex flex-col items-center print:block">

<header class="no-print w-full max-w-[215mm] mb-4 px-4 flex justify-between items-center">
  <div class="flex items-center space-x-2">
    <span class="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
    <span class="text-xs font-semibold tracking-wider uppercase text-slate-500">Documento Oficial Verificado</span>
  </div>
  <div class="flex gap-2.5">
    <button class="inline-flex items-center gap-2 px-4 py-2 bg-[#0f3d64] hover:bg-[#0c3150] text-white text-xs font-semibold rounded-lg shadow-sm transition-all duration-150 active:scale-95" onclick="window.print()" type="button">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>
      Imprimir / Guardar en PDF
    </button>
  </div>
</header>

<!-- ==================== PÁGINA 1: DOCUMENTO OFICIAL ==================== -->
<main class="page-sheet bg-white w-[215mm] min-h-[279mm] p-8 md:p-10 shadow-sheet rounded-sm border border-slate-200/80 flex flex-col justify-between relative overflow-hidden">
  <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0f3d64] via-sky-600 to-[#0f3d64]"></div>
  <div class="space-y-4">

    <section class="border-b border-slate-200 pb-4">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0284c7] to-[#0f3d64] flex items-center justify-center text-white shadow-sm ring-1 ring-sky-900/10 shrink-0">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          </div>
          <div>
            <h1 class="text-lg font-extrabold tracking-tight text-[#0f3d64] leading-tight">FLYNET BUSINESS SYSTEM</h1>
            <p class="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">DEPARTAMENTO DE RECURSOS HUMANOS</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right">
            <div class="inline-block bg-slate-900 text-white font-bold text-[11px] uppercase tracking-widest px-3 py-1 rounded">${isInasistencia ? 'REPORTE DE INASISTENCIA' : 'ACCIÓN DE PERSONAL'}</div>
            <div class="mt-1 flex items-center justify-end gap-1.5">
              <span class="text-[10px] font-bold uppercase text-slate-400">REF:</span>
              <span class="text-xs font-mono font-bold tracking-wider text-[#0f3d64] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">${ref}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-3 pt-2.5 border-t border-dashed border-slate-100 flex justify-between items-center text-xs">
        <span class="text-slate-400 font-medium italic">Gestión de Talento Humano y Nómina</span>
        <div class="text-slate-600">
          <span class="font-semibold text-slate-500">Fecha de Emisión:</span>
          <span class="font-bold text-slate-800 ml-1">${fechaEmision}</span>
        </div>
      </div>
    </section>

    <div class="space-y-4">
      <!-- FILA 1 -->
      <div class="grid grid-cols-12 gap-4">
        <!-- Módulo III: Resolución RRHH -->
        <div class="col-span-7 bg-gradient-to-br ${tone.grad} border ${tone.border} rounded-xl p-4 shadow-bento flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="flex items-center justify-center w-5 h-5 rounded-full bg-[#0f3d64] text-white text-[10px] font-bold">III</span>
                <h2 class="text-xs font-bold uppercase tracking-wider text-slate-700">RESOLUCIÓN RRHH</h2>
              </div>
              <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-white border ${tone.chipBorder} rounded text-[10px] font-bold ${tone.chipText} uppercase tracking-wide shadow-2xs">
                <span class="w-1.5 h-1.5 rounded-full ${tone.dot}"></span>
                ${tone.chipLabel}
              </div>
            </div>
            <div class="flex items-center gap-3.5 bg-white/90 p-3 rounded-lg border border-slate-100 shadow-2xs">
              <div class="w-11 h-11 rounded-full ${tone.circle} text-white flex items-center justify-center shadow-sm shrink-0 ring-4">
                ${isApproved ? checkIcon : crossIcon}
              </div>
              <div>
                <span class="block text-[10px] font-extrabold uppercase tracking-widest ${tone.label}">DICTAMEN FINAL</span>
                <span class="text-base font-extrabold tracking-tight ${tone.value} leading-tight">${dictamen}</span>
              </div>
            </div>
          </div>
          <div class="mt-3 pt-2.5 border-t ${tone.noteBorder} ${tone.noteBg} rounded-md p-2.5">
            <span class="block text-[10px] font-bold uppercase tracking-wider ${tone.noteText} mb-0.5">Observaciones de Administración:</span>
            <span class="text-xs text-slate-700 font-medium italic">${permit.adminNotes ? `"${escapeHtml(permit.adminNotes)}"` : 'Sin observaciones registradas.'}</span>
          </div>
        </div>

        <!-- Módulo II: Detalle de la Acción o Falta -->
        <div class="col-span-5 bg-sky-50/40 border border-sky-100 rounded-xl p-4 shadow-bento flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-2 mb-3">
              <span class="flex items-center justify-center w-5 h-5 rounded-full bg-[#0f3d64] text-white text-[10px] font-bold">II</span>
              <h2 class="text-xs font-bold uppercase tracking-wider text-slate-700">DETALLE DE LA ACCIÓN O FALTA</h2>
            </div>
            <div class="space-y-2.5">
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-sky-800 mb-1">Naturaleza</label>
                <div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-sky-200 rounded text-xs font-bold text-sky-700 shadow-2xs">
                  <svg class="w-3.5 h-3.5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>
                  ${escapeHtml(naturaleza)}
                </div>
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-sky-800 mb-0.5">Periodo</label>
                <p class="text-xs font-semibold text-slate-800">${periodo}</p>
              </div>
            </div>
          </div>
          <div class="mt-3 pt-2 border-t border-sky-100">
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Justificación del Colaborador</label>
            <div class="bg-white/90 p-2 rounded border border-slate-200/80">
              <p class="text-[11px] italic text-slate-700 font-medium leading-snug">"${escapeHtml(permit.justification || '')}"</p>
            </div>
          </div>
        </div>
      </div>

      <!-- FILA 2: Datos del Colaborador -->
      <div class="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5 shadow-bento">
        <div class="flex items-center gap-2 mb-2.5">
          <span class="flex items-center justify-center w-5 h-5 rounded-full bg-[#0f3d64] text-white text-[10px] font-bold">I</span>
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-700">DATOS DEL COLABORADOR</h2>
          <div class="flex-1 h-px bg-slate-200 ml-2"></div>
        </div>
        <div class="grid grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-slate-200/70 divide-x divide-slate-100">
          <div class="px-2 first:pl-1">
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Nombre Completo</label>
            <p class="text-xs font-bold text-slate-900 tracking-tight leading-tight uppercase">${escapeHtml(permit.employeeName)}</p>
          </div>
          <div class="px-3">
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Sucursal / Centro</label>
            <p class="text-xs font-semibold text-slate-800 uppercase">${escapeHtml(permit.branch || '')}</p>
          </div>
          <div class="px-3">
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Puesto Actual</label>
            <p class="text-xs font-semibold text-slate-800 uppercase">${escapeHtml(permit.position || '')}</p>
          </div>
          <div class="px-3">
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Fecha de Solicitud</label>
            <p class="text-xs font-mono font-semibold text-slate-800">${permit.requestDate ? format(parseISO(permit.requestDate), 'dd/MM/yyyy HH:mm') : '--'}</p>
          </div>
        </div>
      </div>

      <!-- FILA 3: Firmas -->
      <div class="pt-1">
        <div class="grid grid-cols-3 gap-3.5">
          <div class="bg-slate-50/60 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between text-center min-h-[125px] shadow-2xs">
            <div class="flex flex-col items-center justify-center flex-1 pb-1">
              <span class="text-[11px] font-serif italic text-slate-400 select-none">Firma de Conformidad</span>
            </div>
            <div class="border-t border-slate-300 pt-2">
              <p class="text-[11px] font-bold uppercase text-slate-800 leading-snug">${escapeHtml(permit.employeeName)}</p>
              <p class="text-[10px] font-semibold tracking-wider uppercase text-slate-500 mt-0.5">Colaborador</p>
            </div>
          </div>
          <div class="bg-slate-50/60 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between text-center min-h-[125px] shadow-2xs">
            <div class="flex flex-col items-center justify-center flex-1 pb-1">
              ${permit.approvedBySupervisorAt
                ? `<span class="text-[9px] font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs mb-1 font-semibold">Firma Digital Validada</span>
                   <span class="text-[10px] font-mono text-slate-600">${format(parseISO(permit.approvedBySupervisorAt), 'dd/MM/yyyy HH:mm')}</span>`
                : `<span class="text-[10px] italic text-slate-400">Pendiente de aval</span>`}
            </div>
            <div class="border-t border-slate-300 pt-2">
              <p class="text-[11px] font-bold uppercase text-slate-800 leading-snug">${escapeHtml(permit.supervisorName || '')}</p>
              <p class="text-[10px] font-semibold tracking-wider uppercase text-slate-500 mt-0.5">Visto Bueno Jefe</p>
            </div>
          </div>
          <div class="bg-slate-50/60 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between text-center min-h-[125px] shadow-2xs">
            <div class="flex flex-col items-center justify-center flex-1 pb-1">
              ${permit.approvedByAdminAt
                ? `<span class="text-[9px] font-mono ${tone.seal} px-2 py-0.5 rounded border shadow-2xs mb-1 font-semibold">${tone.sealLabel}</span>
                   <span class="text-[10px] font-mono text-slate-600">${format(parseISO(permit.approvedByAdminAt), 'dd/MM/yyyy HH:mm')}</span>`
                : `<span class="text-[10px] italic text-slate-400">Pendiente de resolución</span>`}
            </div>
            <div class="border-t border-slate-300 pt-2">
              <p class="text-[11px] font-bold uppercase text-slate-800 leading-snug">${escapeHtml(permit.approvedByAdminName || 'ADMINISTRACIÓN')}</p>
              <p class="text-[10px] font-semibold tracking-wider uppercase text-slate-500 mt-0.5">Resolución RRHH</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <footer class="mt-6 pt-3 border-t border-slate-200">
    <div class="flex items-center justify-between gap-4">
      <div class="flex-1">
        <p class="text-[9px] uppercase font-bold tracking-wider text-slate-500 leading-tight">DOCUMENTO GENERADO ELECTRÓNICAMENTE POR FLYNET BUSINESS SYSTEM. SISTEMA DE GESTIÓN RRHH.</p>
        <div class="mt-1 flex items-center gap-2.5 text-[9px] text-slate-400 font-mono">
          <span>HASH: ${hash}...</span><span>•</span><span>ID: ${ref}</span><span>•</span><span>VERIFICACIÓN DIGITAL VÁLIDA</span>
        </div>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <div class="flex items-center space-x-0.5 h-5 opacity-70">
          <span class="w-0.5 h-5 bg-slate-800"></span><span class="w-1 h-5 bg-slate-800"></span><span class="w-0.5 h-5 bg-slate-800"></span><span class="w-1.5 h-5 bg-slate-800"></span><span class="w-0.5 h-5 bg-slate-800"></span><span class="w-1 h-5 bg-slate-800"></span><span class="w-0.5 h-5 bg-slate-800"></span><span class="w-1 h-5 bg-slate-800"></span><span class="w-1.5 h-5 bg-slate-800"></span><span class="w-0.5 h-5 bg-slate-800"></span>
        </div>
        <div class="text-right pl-3 border-l border-slate-200 text-[10px] text-slate-400">
          Página <span class="font-bold text-slate-700">1</span> de <span class="font-bold text-slate-700">${hasEvidence ? '2' : '1'}</span>
        </div>
      </div>
    </div>
  </footer>
</main>

${hasEvidence ? `
<!-- ==================== PÁGINA 2: EVIDENCIA ADJUNTA ==================== -->
<main class="page-sheet bg-white w-[215mm] min-h-[279mm] p-8 md:p-10 shadow-sheet rounded-sm border border-slate-200/80 flex flex-col justify-between relative overflow-hidden mt-6 print:mt-0">
  <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0f3d64] via-sky-600 to-[#0f3d64]"></div>

  <div class="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
    <div class="flex items-center gap-2.5">
      <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0284c7] to-[#0f3d64] flex items-center justify-center text-white shrink-0">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" stroke-linecap="round" stroke-linejoin="round"></path></svg>
      </div>
      <div>
        <h1 class="text-sm font-extrabold tracking-tight text-[#0f3d64] leading-tight">FLYNET BUSINESS SYSTEM</h1>
        <p class="text-[9px] font-semibold tracking-wider text-slate-500 uppercase">Anexo de Evidencia</p>
      </div>
    </div>
    <div class="text-right">
      <div class="inline-block bg-slate-900 text-white font-bold text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded">EVIDENCIA ADJUNTA</div>
      <div class="mt-1 flex items-center justify-end gap-1.5">
        <span class="text-[9px] font-bold uppercase text-slate-400">REF:</span>
        <span class="text-[10px] font-mono font-bold tracking-wider text-[#0f3d64] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">${ref}</span>
      </div>
    </div>
  </div>

  <div class="bg-slate-50/80 border border-slate-200/90 rounded-lg p-2.5 mb-4 grid grid-cols-3 gap-3 text-[10px]">
    <div>
      <span class="block font-bold uppercase tracking-wider text-slate-400">Colaborador</span>
      <span class="font-bold text-slate-800 uppercase">${escapeHtml(permit.employeeName)}</span>
    </div>
    <div>
      <span class="block font-bold uppercase tracking-wider text-slate-400">Trámite</span>
      <span class="font-bold text-slate-800">${escapeHtml(naturaleza)}</span>
    </div>
    <div>
      <span class="block font-bold uppercase tracking-wider text-slate-400">Periodo</span>
      <span class="font-bold text-slate-800">${periodo}</span>
    </div>
  </div>

  <div class="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/30">
    ${evidenceIsImage
      ? `<img src="${permit.evidenceFileDataUri}" alt="Evidencia adjunta" class="max-w-full max-h-[190mm] object-contain shadow-lg rounded-lg border-4 border-white" />`
      : `<div class="flex flex-col items-center gap-3 text-center">
           <div class="w-16 h-16 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center">
             <svg class="w-8 h-8 text-sky-600" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke-linecap="round" stroke-linejoin="round"></path></svg>
           </div>
           <div>
             <p class="text-sm font-bold text-slate-700">Documento PDF Adjunto</p>
             <p class="text-[11px] text-slate-500 mt-1">${escapeHtml(permit.evidence || 'El justificante fue cargado en formato PDF.')}</p>
           </div>
           <p class="text-[10px] text-slate-400 italic max-w-[300px]">El archivo original se encuentra disponible en el sistema para su consulta y descarga.</p>
         </div>`}
  </div>

  <footer class="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
    <p class="text-[9px] uppercase font-bold tracking-wider text-slate-500">ANEXO DE EVIDENCIA — DOCUMENTO GENERADO ELECTRÓNICAMENTE POR FLYNET BUSINESS SYSTEM.</p>
    <div class="text-right pl-3 border-l border-slate-200 text-[10px] text-slate-400">
      Página <span class="font-bold text-slate-700">2</span> de <span class="font-bold text-slate-700">2</span>
    </div>
  </footer>
</main>
` : ''}

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
