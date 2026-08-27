'use client';

import { WarningRecord } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Shield } from 'lucide-react';
import { ORDINALES_ART31, ORDINALES_ART32, ORDINALES_ART50 } from '@/lib/faltas-catalogo';

function expandOrdinales(value?: string, mapa?: Record<string, string>) {
  if (!value) return [];
  const ords = value.match(/\d+°/g) || [];
  return ords
    .map((o) => ({ ordinal: o, texto: mapa?.[o] || '' }))
    .filter((x) => x.texto);
}

function BaseLegal({ label, articulo, value, mapa }: { label: string; articulo: string; value?: string; mapa?: Record<string, string> }) {
  const items = expandOrdinales(value, mapa);
  if (items.length === 0) {
    if (!value) return null;
    return <li><strong>{articulo}:</strong> {value}</li>;
  }
  return (
    <li>
      <strong>{articulo}, {label}:</strong>
      <ul className="list-disc pl-5 mt-1 space-y-1">
        {items.map((it) => (
          <li key={it.ordinal}><strong>Ordinal {it.ordinal}:</strong> {it.texto}</li>
        ))}
      </ul>
    </li>
  );
}

export function WarningPdfTemplate({ warning }: { warning: WarningRecord }) {
  const fecha = (v?: string) => (v ? format(parseISO(v), 'dd/MM/yyyy') : '________________');

  return (
    <div className="pdf-page p-14 bg-white text-black font-serif w-[816px] min-h-[1056px] flex flex-col border border-gray-100">
      {/* Encabezado */}
      <div className="flex justify-between items-start border-b-2 border-zinc-900 pb-5 mb-6">
        <div className="flex items-center gap-3">
          <Shield className="h-12 w-12 text-zinc-900" />
          <div>
            <h1 className="text-xl font-black tracking-tighter">FLYNET BUSINESS SYSTEM</h1>
            <p className="text-[10px] font-sans font-bold uppercase text-zinc-500">Gestión de Talento Humano y Asuntos Laborales</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-sm font-black bg-zinc-900 text-white px-3 py-1.5 rounded-sm">MEMORÁNDUM DISCIPLINARIO N.° {warning.numeroMemorandum || '________'}</h2>
          <p className="text-[9px] mt-1 font-mono uppercase font-bold text-zinc-500">REF: EXPEDIENTE DISCIPLINARIO LABORAL</p>
        </div>
      </div>

      {/* Datos del destinatario */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[12px] leading-relaxed mb-6">
        <p><strong>FECHA:</strong> {fecha(warning.date)}</p>
        <p><strong>DE:</strong> Departamento de Recursos Humanos</p>
        <p><strong>PARA:</strong> <span className="uppercase font-bold">{warning.employeeName}</span></p>
        <p><strong>ASUNTO:</strong> AMONESTACIÓN ESCRITA POR {warning.motivo || warning.tipoFalta || '________________'}</p>
        <p><strong>ID/PIN:</strong> <span className="font-mono">{warning.employeeId || '________'}</span></p>
        <p><strong>DUI:</strong> {warning.dui || '________________'}</p>
        <p><strong>CARGO:</strong> {warning.position || '________________'}</p>
        <p><strong>DEPARTAMENTO:</strong> {warning.department || '________________'}</p>
      </div>

      {/* Cuerpo */}
      <div className="space-y-5 text-[12px] leading-relaxed flex-1">
        <section>
          <h3 className="font-black border-b border-zinc-900 mb-2 uppercase text-[11px]">1. BASE LEGAL</h3>
          <p className="text-justify">
            La presente medida se dicta en ejercicio de las facultades de dirección empresarial, con fundamento en:
          </p>
          <ul className="mt-2 space-y-2 list-disc pl-5 text-justify">
            <BaseLegal label="ordinales aplicables" articulo="Art. 31" value={warning.art31} mapa={ORDINALES_ART31} />
            <BaseLegal label="ordinales aplicables" articulo="Art. 32" value={warning.art32} mapa={ORDINALES_ART32} />
            <li><strong>Art. 304 del Código de Trabajo</strong>, en relación con el Reglamento Interno de Trabajo de la empresa, aprobado por el Ministerio de Trabajo y Previsión Social.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-black border-b border-zinc-900 mb-2 uppercase text-[11px]">2. HECHOS CONSTATADOS</h3>
          <p className="text-justify">
            Se ha verificado que usted, con fecha <strong>{fecha(warning.incidentDate)}</strong>, incurrió en la siguiente conducta contraria a las normativas laborales y al Reglamento Interno:
          </p>
          <div className="mt-2 p-4 border-l-4 border-zinc-900 bg-zinc-50 italic text-justify">
            {warning.descripcion || '________________________________________________'}
          </div>
          <p className="mt-2 text-justify">
            Dicha situación ha sido documentada mediante los registros y controles de la empresa, y confirmada por su jefatura inmediata.
          </p>
        </section>

        <section>
          <h3 className="font-black border-b border-zinc-900 mb-2 uppercase text-[11px]">3. CALIFICACIÓN DE LA FALTA</h3>
          <p className="text-justify">
            La conducta descrita constituye, en esta primera ocasión, una <strong>falta leve</strong> conforme al Reglamento Interno de Trabajo, por lo que se aplica una amonestación escrita como medida correctiva.
          </p>
        </section>

        <section>
          <h3 className="font-black border-b border-zinc-900 mb-2 uppercase text-[11px]">4. RESOLUCIÓN</h3>
          <p className="text-justify">
            Se impone a usted una <strong>AMONESTACIÓN ESCRITA</strong>, la cual quedará registrada en su expediente laboral como antecedente disciplinario.
          </p>
        </section>

        <section>
          <h3 className="font-black border-b border-zinc-900 mb-2 uppercase text-[11px]">5. ADVERTENCIA FORMAL</h3>
          <p className="text-justify">
            Se le previene que la reincidencia en faltas de naturaleza similar, o la comisión de una falta grave conforme al Reglamento Interno y al Código de Trabajo, podrá dar lugar a sanciones progresivamente más severas, incluyendo el despido sin responsabilidad patronal.
          </p>
          {warning.art50 && (
            <div className="mt-2 space-y-1">
              {expandOrdinales(warning.art50, ORDINALES_ART50).length > 0 ? (
                expandOrdinales(warning.art50, ORDINALES_ART50).map((it) => (
                  <p key={it.ordinal} className="text-justify"><strong>Art. 50, ordinal {it.ordinal}:</strong> {it.texto}</p>
                ))
              ) : (
                <p className="text-justify"><strong>Art. 50 del Código de Trabajo:</strong> {warning.art50}</p>
              )}
            </div>
          )}
        </section>

        <section>
          <h3 className="font-black border-b border-zinc-900 mb-2 uppercase text-[11px]">6. DERECHO A DESCARGO</h3>
          <p className="text-justify">
            Se le concede un plazo de tres (3) días hábiles, contados a partir de la recepción del presente, para que presente sus descargos o justificaciones por escrito ante el Departamento de Recursos Humanos, si lo estimare conveniente.
          </p>
        </section>

        <section>
          <h3 className="font-black border-b border-zinc-900 mb-2 uppercase text-[11px]">7. FIRMAS Y NOTIFICACIÓN</h3>
          <p className="text-justify">
            El presente memorándum se extiende en dos tantos, quedando uno en su expediente personal y otro en poder del trabajador, quien con su firma acusa recibo, sin que ello implique aceptación de los hechos.
          </p>
        </section>
      </div>

      {/* Firmas */}
      <div className="pt-10 grid grid-cols-2 gap-16">
        <div className="text-center space-y-1">
          <p className="text-[11px] italic">Atentamente,</p>
          <div className="border-t border-zinc-900 pt-2 mt-8">
            <p className="font-bold uppercase text-[11px]">{warning.representanteRrhh || '________________'}</p>
            <p className="text-[9px] text-zinc-500 uppercase font-bold">Departamento de Recursos Humanos</p>
            <p className="text-[9px] text-zinc-500">Flynet Business System</p>
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-[11px] italic">Recibí conforme:</p>
          <div className="border-t border-zinc-900 pt-2 mt-8">
            <p className="font-bold uppercase text-[11px]">{warning.employeeName}</p>
            <p className="text-[9px] text-zinc-500 uppercase font-bold">Nombre del Trabajador</p>
            <p className="text-[9px] text-zinc-400 italic">Fecha: _______________</p>
          </div>
        </div>
      </div>

      <div className="mt-10 pt-4 border-t text-[8px] text-center text-zinc-400 uppercase tracking-[0.2em] font-sans">
        Documento Oficial de Flynet Business System - Gestión de Talento Humano y Asuntos Laborales
      </div>
    </div>
  );
}
