'use client';

import { WarningRecord } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Shield } from 'lucide-react';

export function WarningPdfTemplate({ warning }: { warning: WarningRecord }) {
  return (
    <div className="pdf-page p-16 bg-white text-black font-serif w-[816px] h-[1056px] flex flex-col border border-gray-100">
      {/* Encabezado */}
      <div className="flex justify-between items-start border-b-2 border-zinc-900 pb-6 mb-10">
        <div className="flex items-center gap-4">
          <Shield className="h-14 w-14 text-zinc-900" />
          <div>
            <h1 className="text-2xl font-black tracking-tighter">FLYNET BUSINESS SYSTEM</h1>
            <p className="text-xs font-sans font-bold uppercase text-zinc-500">Gestión de Talento Humano y Asuntos Laborales</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-black bg-zinc-900 text-white px-4 py-2 rounded-sm">MEMORÁNDUM</h2>
          <p className="text-[10px] mt-1 font-mono uppercase font-bold text-zinc-500">REF: EXPEDIENTE DISCIPLINARIO LABORAL</p>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="space-y-8 text-[12px] leading-relaxed flex-1">
        <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-6 rounded-lg border border-zinc-200">
          <div className="space-y-3">
            <p><strong>FECHA:</strong> {format(parseISO(warning.date), "dd 'de' MMMM 'de' yyyy", { locale: es })}</p>
            <p><strong>PARA:</strong> <span className="uppercase font-bold">{warning.employeeName}</span></p>
            <p><strong>ID/PIN:</strong> <span className="font-mono">{warning.employeeId}</span></p>
          </div>
          <div className="space-y-3 text-right">
            <p><strong>DE:</strong> Departamento de Recursos Humanos</p>
            <p><strong>ASUNTO:</strong> <span className="bg-zinc-200 px-2 font-bold">AMONESTACIÓN ESCRITA</span></p>
            <p><strong>DUI:</strong> {warning.dui || '________________'}</p>
          </div>
        </div>

        <section>
          <h3 className="font-black border-b border-zinc-900 mb-2 uppercase text-[11px]">1. FUNDAMENTO LEGAL</h3>
          <p className="text-justify">
            La presente medida disciplinaria se emite en ejercicio de las facultades de dirección de la empresa y en estricto apego a lo establecido en el <strong>Código de Trabajo de El Salvador</strong>, fundamentándose en las siguientes disposiciones:
          </p>
          <ul className="mt-2 space-y-2 list-disc pl-5">
            <li><strong>Art. 31, ordinal 2º y 10º:</strong> Que establece como obligaciones del trabajador "Observar estricta disciplina en el desempeño de su cargo o empleo" y "Asistir a sus labores con puntualidad".</li>
            <li><strong>Art. 32, ordinal 2º:</strong> Que prohíbe terminantemente a los trabajadores "Faltar al trabajo sin el correspondiente permiso o sin causa justificada".</li>
            <li><strong>Art. 304:</strong> En concordancia con las medidas disciplinarias estipuladas en el Reglamento Interno de Trabajo de la empresa, debidamente aprobado por el Ministerio de Trabajo y Previsión Social.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-black border-b border-zinc-900 mb-2 uppercase text-[11px]">2. DESCRIPCIÓN DE LA FALTA</h3>
          <p className="text-justify">
            Se hace constar en su expediente personal que usted ha incurrido en una infracción a las normativas antes citadas, debido a:
          </p>
          <div className="mt-2 p-4 border-l-4 border-zinc-900 bg-zinc-50 italic">
            <strong>Detalle del Incidente:</strong> Inasistencia a sus labores sin permiso previo ni causa justificada el día <strong>{format(parseISO(warning.incidentDate), "dd 'de' MMMM 'de' yyyy", { locale: es })}</strong>.
          </div>
        </section>

        <section>
          <h3 className="font-black border-b border-zinc-900 mb-2 uppercase text-[11px]">3. RESOLUCIÓN Y ADVERTENCIA</h3>
          <p className="text-justify">
            Con base en los hechos descritos, la empresa resuelve aplicar la presente <strong>AMONESTACIÓN ESCRITA</strong>. 
            Se le advierte de manera formal que la reincidencia en esta conducta, específicamente faltar a sus labores sin permiso o sin causa justificada durante dos días laborales completos y consecutivos, o durante tres días en un mismo mes calendario, constituye causal de despido sin responsabilidad para el patrono, tal como lo dicta el <strong>Art. 50, ordinal 12º del Código de Trabajo</strong>.
          </p>
          <p className="mt-2 font-bold italic">Se le exhorta a corregir esta situación inmediatamente y cumplir a cabalidad con su horario y asistencia.</p>
        </section>

        <section>
          <h3 className="font-black border-b border-zinc-900 mb-2 uppercase text-[11px]">4. DERECHO A DESCARGO</h3>
          <p className="text-xs text-zinc-500 mb-2 italic">En este acto, se le concede el espacio para que exprese los comentarios o justificaciones que considere pertinentes respecto a este incidente.</p>
          <div className="h-24 border border-zinc-300 p-3 rounded bg-white">
            {warning.comments || ''}
          </div>
        </section>

        {/* Firmas */}
        <div className="pt-12 grid grid-cols-2 gap-20">
          <div className="text-center space-y-1">
            <div className="border-t border-zinc-900 pt-2">
              <p className="font-bold uppercase text-[10px]">{warning.employeeName}</p>
              <p className="text-[9px] text-zinc-500 uppercase font-bold">Firma del Trabajador</p>
              <p className="text-[8px] text-zinc-400 italic">(La firma no implica aceptación, únicamente recepción)</p>
            </div>
          </div>
          <div className="text-center space-y-1">
            <div className="border-t border-zinc-900 pt-2">
              <p className="font-bold uppercase text-[10px]">Departamento de Administración</p>
              <p className="text-[9px] text-zinc-500 uppercase font-bold">Sello y Firma Patronal</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 pt-4 border-t text-[8px] text-center text-zinc-400 uppercase tracking-[0.2em] font-sans">
        Documento Oficial de Flynet Business System - Registro de Incidencias Laborales
      </div>
    </div>
  );
}
