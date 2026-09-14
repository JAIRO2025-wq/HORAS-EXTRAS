import fs from 'fs/promises';
import path from 'path';

const sharesDir = path.join(process.cwd(), 'data', 'report-shares');

type SharedRecord = {
  date: string;
  startTime?: string;
  endTime?: string;
  activity?: string;
  coworkers?: string;
  quincena?: number;
  totalHours?: number;
  dayHours?: number;
  nightHours?: number;
  type?: string;
  status?: string;
};

type SharedReport = {
  id: string;
  employeeName: string;
  month: string;
  quincena: number | null;
  records: SharedRecord[];
  createdAt: string;
  createdBy: string;
};

function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '--';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

/**
 * Vista pública (solo lectura) del reporte de horas extra compartido por QR.
 * No requiere autenticación: el ID aleatorio actúa como token de acceso.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!/^[a-f0-9]{12}$/.test(id)) {
    return new Response('Reporte no válido', { status: 400 });
  }

  let report: SharedReport;
  try {
    const content = await fs.readFile(path.join(sharesDir, `${id}.json`), 'utf-8');
    report = JSON.parse(content);
  } catch {
    return new Response(notFoundHtml(), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const approved = report.records
    .filter(r => r.status === 'approved' || r.status === 'rejected')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let totalDay = 0;
  let totalNight = 0;
  let totalHours = 0;
  for (const r of approved) {
    if (r.status !== 'approved') continue;
    totalDay += r.dayHours ?? 0;
    totalNight += r.nightHours ?? 0;
    totalHours += r.totalHours ?? 0;
  }

  const approvedCount = approved.filter(r => r.status === 'approved').length;
  const rejectedCount = approved.filter(r => r.status === 'rejected').length;

  const rows = approved.map((r, i) => {
    const isRejected = r.status === 'rejected';
    return `
    <tr class="${isRejected ? 'rejected' : ''}">
      <td class="c">${i + 1}</td>
      <td>${formatDate(r.date)}</td>
      <td class="c mono">${escapeHtml(r.startTime || '--')} → ${escapeHtml(r.endTime || '--')}</td>
      <td class="c b ${isRejected ? 'strike' : ''}">${(r.totalHours ?? 0).toFixed(2)}</td>
      <td class="c ${isRejected ? 'muted' : ''}">${(r.dayHours ?? 0).toFixed(2)}</td>
      <td class="c ${isRejected ? 'muted' : ''}">${(r.nightHours ?? 0).toFixed(2)}</td>
      <td class="c">${r.type === 'additional_day' ? 'Día Adicional' : 'Hora Extra'}</td>
      <td>${escapeHtml(r.activity || '--')}</td>
      <td class="c">Q${r.quincena ?? '-'}</td>
      <td class="c"><span class="pill ${isRejected ? 'pill-rej' : 'pill-ok'}">${isRejected ? 'Rechazado' : 'Aprobado'}</span></td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex, nofollow" />
<title>Reporte de Horas Adicionales — ${escapeHtml(report.employeeName)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; padding:0; background:#eef2f7; color:#0f172a;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    font-size:13px; line-height:1.5; -webkit-font-smoothing:antialiased; }
  .wrap { width: 100%; max-width: 100%; margin: 0 auto; padding: 24px 32px 40px; }

  /* Encabezado institucional */
  .masthead { background: linear-gradient(135deg, #0a2540 0%, #123a5e 100%); color:#fff;
    border-radius:14px 14px 0 0; padding:22px 26px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
  .brand { display:flex; align-items:center; gap:14px; }
  .brand-mark { width:46px; height:46px; border-radius:11px; background:#0080c8;
    display:flex; align-items:center; justify-content:center; flex-shrink:0;
    box-shadow:0 4px 12px rgba(0,128,200,.35); }
  .brand-mark svg { width:26px; height:26px; }
  .brand h1 { margin:0; font-size:17px; font-weight:800; letter-spacing:.4px; text-transform:uppercase; }
  .brand p { margin:3px 0 0; font-size:10px; color:#93c5fd; text-transform:uppercase;
    letter-spacing:1.2px; font-weight:700; }
  .doc-tag { text-align:right; flex-shrink:0; }
  .doc-tag .label { font-size:9px; text-transform:uppercase; letter-spacing:1px; color:#93c5fd; font-weight:700; }
  .doc-tag .value { font-size:12px; font-weight:800; font-family: ui-monospace, Menlo, monospace; }

  /* Barra de estado */
  .statusbar { background:#fff; border:1px solid #dbe3ec; border-top:none;
    padding:10px 26px; display:flex; align-items:center; justify-content:space-between;
    gap:12px; flex-wrap:wrap; border-radius:0 0 14px 14px; margin-bottom:18px; }
  .statusbar .item { display:flex; align-items:center; gap:7px; font-size:11px; color:#475569; }
  .statusbar .item strong { color:#0f172a; font-weight:700; }
  .dot { width:7px; height:7px; border-radius:50%; background:#10b981; flex-shrink:0;
    box-shadow:0 0 0 3px rgba(16,185,129,.18); }

  /* Tarjetas */
  .card { background:#fff; border:1px solid #dbe3ec; border-radius:12px; margin-bottom:16px;
    box-shadow:0 1px 3px rgba(15,23,42,.04); overflow:hidden; }
  .card-head { padding:12px 20px; border-bottom:1px solid #eef2f7; display:flex;
    align-items:center; justify-content:space-between; gap:12px; background:#fbfcfe; }
  .card-head h2 { margin:0; font-size:11px; font-weight:800; text-transform:uppercase;
    letter-spacing:.8px; color:#334155; display:flex; align-items:center; gap:8px; }
  .card-head h2::before { content:''; width:3px; height:14px; border-radius:2px; background:#0080c8; }
  .card-body { padding:18px 20px; }

  /* KPIs */
  .grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:14px; }
  .kpi { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; }
  .kpi span { display:block; font-size:9px; text-transform:uppercase; letter-spacing:.7px;
    color:#64748b; font-weight:800; margin-bottom:4px; }
  .kpi strong { font-size:19px; font-weight:800; color:#0f172a; letter-spacing:-.3px; }
  .kpi small { font-size:10px; color:#64748b; font-weight:600; margin-left:3px; }
  .kpi.accent { background:#f0f9ff; border-color:#bae6fd; }
  .kpi.accent strong { color:#075985; }

  /* Tarjeta de identificación (misma estética del reporte PDF) */
  .idcard { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px;
    padding:16px 20px; display:flex; align-items:center; justify-content:space-between;
    gap:24px; flex-wrap:wrap; }
  .idcard-left { min-width:240px; }
  .idcard-label { font-size:9px; text-transform:uppercase; letter-spacing:.8px;
    color:#64748b; font-weight:800; }
  .idcard-name { font-size:20px; font-weight:900; color:#0f172a; text-transform:uppercase;
    letter-spacing:-.3px; line-height:1.2; margin-top:2px; }
  .idcard-meta { font-size:11px; color:#64748b; margin-top:6px; }
  .idcard-meta strong { color:#334155; font-weight:700; }
  .idcard-meta .sep { margin:0 6px; color:#cbd5e1; }
  .idcard-right { display:flex; align-items:center; gap:28px; flex-wrap:wrap; }
  .idcard-stat { text-align:right; }
  .idcard-value { font-size:19px; font-weight:900; color:#0c4a6e; letter-spacing:-.3px; margin-top:3px; }
  .idcard-value .unit { font-size:10px; font-weight:700; color:#0369a1; }
  .idcard-badges { display:flex; align-items:center; gap:6px; margin-top:5px; justify-content:flex-end; flex-wrap:wrap; }
  .chip { display:inline-block; padding:3px 9px; border-radius:6px; font-size:10px; font-weight:800; }
  .chip-day { background:#fde68a; color:#78350f; }
  .chip-night { background:#e0e7ff; color:#312e81; }
  .dict { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:900;
    text-transform:uppercase; letter-spacing:.2px; }
  .dict svg { width:14px; height:14px; }
  .dict-ok { color:#065f46; }
  .dict-rej { color:#9f1239; }
  .status-chip { font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.5px;
    padding:3px 10px; border-radius:999px; }
  .status-chip.ok { background:#dcfce7; color:#166534; }
  .status-chip.neutral { background:#e2e8f0; color:#475569; }

  /* Tabla */
  table { width:100%; border-collapse:collapse; font-size:11.5px; }
  th { background:#f1f5f9; text-align:left; padding:9px 10px; font-size:9px;
    text-transform:uppercase; letter-spacing:.6px; color:#475569; font-weight:800;
    border-bottom:1px solid #dbe3ec; white-space:nowrap; }
  td { padding:8px 10px; border-bottom:1px solid #f1f5f9; vertical-align:top; }
  tbody tr:nth-child(even) td { background:#fafbfc; }
  tbody tr:hover td { background:#f0f9ff; }
  .c { text-align:center; }
  .b { font-weight:800; color:#0369a1; }
  .mono { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-size:10.5px; }
  tfoot td { background:#f1f5f9 !important; font-weight:800; border-top:2px solid #cbd5e1;
    font-size:11px; }

  /* Pills de estado */
  .pill { display:inline-block; border-radius:999px; padding:2px 9px; font-size:9px;
    font-weight:800; text-transform:uppercase; letter-spacing:.3px; }
  .pill-ok { background:#dcfce7; color:#166534; }
  .pill-rej { background:#ffe4e6; color:#9f1239; }
  .badge { display:inline-block; background:#dcfce7; color:#166534; border-radius:999px;
    padding:2px 10px; font-size:10px; font-weight:800; text-transform:uppercase; }
  .badge-rej { background:#ffe4e6; color:#9f1239; }
  tr.rejected td { background:#fff5f6 !important; }
  .strike { text-decoration:line-through; color:#94a3b8 !important; }
  .muted { color:#94a3b8 !important; }

  /* Nota legal */
  .notice { background:#f8fafc; border:1px solid #e2e8f0; border-left:3px solid #0080c8;
    border-radius:8px; padding:12px 16px; font-size:10.5px; color:#475569; line-height:1.6; }
  .notice strong { color:#0f172a; }

  /* Pie */
  .foot { text-align:center; font-size:10px; color:#94a3b8; padding:14px 0 0; line-height:1.7; }
  .foot .ref { font-family: ui-monospace, Menlo, monospace; color:#64748b; font-weight:700; }

  @media (max-width: 640px) {
    .masthead { flex-direction:column; align-items:flex-start; }
    .doc-tag { text-align:left; }
    .wrap { padding:12px 12px 30px; }
    table { font-size:10.5px; }
    th, td { padding:6px 7px; }
    .idcard { flex-direction:column; align-items:flex-start; gap:16px; }
    .idcard-right { gap:18px; width:100%; justify-content:space-between; }
    .idcard-stat { text-align:left; }
    .idcard-badges { justify-content:flex-start; }
  }
  @media print {
    body { background:#fff; }
    .wrap { padding:0; max-width:100%; }
    .card, .masthead, .statusbar { box-shadow:none; border-radius:0; }
    .card { page-break-inside:avoid; }
  }
</style>
</head>
<body>
<div class="wrap">

  <div class="masthead">
    <div class="brand">
      <div class="brand-mark">
        <svg fill="none" stroke="#ffffff" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
      </div>
      <div>
        <h1>Flynet Business System</h1>
        <p>Departamento de Recursos Humanos</p>
      </div>
    </div>
    <div class="doc-tag">
      <div class="label">Documento</div>
      <div class="value">HE-${escapeHtml(report.id.toUpperCase())}</div>
    </div>
  </div>

  <div class="statusbar">
    <div class="item"><span class="dot"></span> <strong>Documento verificado</strong> — Consulta digital de horas adicionales</div>
    <div class="item">Emitido el <strong>${formatDate(report.createdAt)}</strong></div>
  </div>

  <div class="card">
    <div class="card-head">
      <h2>Identificación del Colaborador</h2>
      <span class="status-chip ${approvedCount > 0 ? 'ok' : 'neutral'}">${approvedCount > 0 ? 'Con dictamen' : 'Sin dictamen'}</span>
    </div>
    <div class="card-body">
      <div class="idcard">
        <div class="idcard-left">
          <div class="idcard-label">Colaborador / Empleado</div>
          <div class="idcard-name">${escapeHtml(report.employeeName)}</div>
          <div class="idcard-meta">
            Quincena: <strong>${report.quincena ? `Q${report.quincena} (${report.quincena === 1 ? 'Primera' : 'Segunda'} Quincena)` : 'Ambas quincenas'}</strong>
            <span class="sep">•</span>
            Período: <strong>${escapeHtml(report.month)}</strong>
          </div>
        </div>
        <div class="idcard-right">
          <div class="idcard-stat">
            <div class="idcard-label">Total Horas</div>
            <div class="idcard-value">${totalHours.toFixed(2)} <span class="unit">horas reg.</span></div>
          </div>
          <div class="idcard-stat">
            <div class="idcard-label">Distribución Jornada</div>
            <div class="idcard-badges">
              <span class="chip chip-day">Diurna: ${totalDay.toFixed(1)}h</span>
              <span class="chip chip-night">Nocturna: ${totalNight.toFixed(1)}h</span>
            </div>
          </div>
          <div class="idcard-stat">
            <div class="idcard-label">Dictamen RRHH</div>
            <div class="idcard-badges">
              <span class="dict dict-ok">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"></path></svg>
                ${approvedCount} Aprobado${approvedCount === 1 ? '' : 's'}
              </span>
              ${rejectedCount > 0 ? `
              <span class="dict dict-rej">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18L18 6M6 6l12 12"></path></svg>
                ${rejectedCount} Rechazado${rejectedCount === 1 ? '' : 's'}
              </span>` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <h2>Detalle de Registros</h2>
      <span style="font-size:10px;color:#64748b;font-weight:700">${approved.length} registro${approved.length === 1 ? '' : 's'}</span>
    </div>
    <div style="overflow-x:auto;">
      <table>
        <thead>
          <tr>
            <th class="c">#</th><th>Fecha</th><th class="c">Horario</th><th class="c">Total</th>
            <th class="c">Diurnas</th><th class="c">Nocturnas</th><th class="c">Tipo</th>
            <th>Actividad Realizada</th><th class="c">Q</th><th class="c">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="10" class="c" style="padding:28px;color:#94a3b8">Sin registros aprobados ni rechazados en el período.</td></tr>`}
        </tbody>
        ${approved.length > 0 ? `
        <tfoot>
          <tr>
            <td colspan="3" style="text-align:right;text-transform:uppercase;font-size:10px;color:#475569">Total Acumulado del Período:</td>
            <td class="c b">${totalHours.toFixed(2)}</td>
            <td class="c">${totalDay.toFixed(2)}</td>
            <td class="c">${totalNight.toFixed(2)}</td>
            <td colspan="4"></td>
          </tr>
        </tfoot>` : ''}
      </table>
    </div>
  </div>

  <div class="notice">
    <strong>Nota:</strong> Este documento es una constancia digital de consulta generada automáticamente por el
    sistema de Recursos Humanos. Los montos y horas reflejados corresponden únicamente a los registros con
    dictamen de la administración. Para cualquier aclaración, comuníquese con el Departamento de Recursos Humanos.
  </div>

  <div class="foot">
    Flynet Business System · Gestión de Talento y Nómina<br/>
    Referencia: <span class="ref">${escapeHtml(report.id.toUpperCase())}</span> · Emitido el ${formatDate(report.createdAt)} por ${escapeHtml(report.createdBy)}
  </div>
</div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, max-age=300',
    },
  });
}

function notFoundHtml(): string {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Reporte no encontrado</title>
<style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#0f172a}
div{text-align:center}h1{font-size:18px;margin:0 0 6px}p{font-size:13px;color:#64748b;margin:0}</style>
</head><body><div><h1>Reporte no encontrado</h1>
<p>El enlace es inválido o el reporte ya no está disponible.</p></div></body></html>`;
}
