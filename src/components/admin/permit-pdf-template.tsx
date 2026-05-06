'use client';

import { PermitRequest } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Shield, CheckCircle2, XCircle, Clock, FileSearch } from 'lucide-react';

export function PermitPdfTemplate({ permit }: { permit: PermitRequest }) {
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return 'AUTORIZADO / APROBADO';
      case 'rejected': return 'DENEGADO / RECHAZADO';
      case 'pending_admin': return 'PENDIENTE DE FIRMA GERENCIAL';
      default: return 'EN TRÁMITE';
    }
  };

  const isInasistencia = permit.action === 'INASISTENCIA';

  return (
    <div className="p-12 bg-white text-black font-serif w-[800px] border border-gray-200">
      {/* Membrete */}
      <div className="flex justify-between items-start border-b-2 border-primary pb-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-primary">FLYNET BUSINESS SYSTEM</h1>
            <p className="text-xs uppercase font-sans font-bold text-gray-500">Departamento de Recursos Humanos</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-black bg-gray-100 px-4 py-2 rounded-md uppercase">
            {isInasistencia ? 'REPORTE DE INASISTENCIA' : 'ACCIÓN DE PERSONAL'}
          </h2>
          <p className="text-xs mt-1 font-mono">REF: {permit.id.substring(0, 8).toUpperCase()}</p>
        </div>
      </div>

      {/* Cuerpo del Documento */}
      <div className="space-y-8">
        <p className="text-sm text-right">
          Fecha de Emisión: <strong>{format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es })}</strong>
        </p>

        <section>
          <h3 className="text-xs font-black uppercase border-b mb-4 text-gray-600 tracking-widest">I. Datos del Colaborador</h3>
          <div className="grid grid-cols-2 gap-y-4 text-sm">
            <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Nombre Completo:</span> <p className="font-bold uppercase">{permit.employeeName}</p></div>
            <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Sucursal / Centro:</span> <p className="font-bold uppercase">{permit.branch}</p></div>
            <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Puesto Actual:</span> <p className="font-bold uppercase">{permit.position}</p></div>
            <div><span className="text-gray-500 block text-[10px] uppercase font-bold">Fecha de Solicitud:</span> <p className="font-bold">{format(parseISO(permit.requestDate), "dd/MM/yyyy HH:mm")}</p></div>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-black uppercase border-b mb-4 text-gray-600 tracking-widest">II. Detalle de la Acción o Falta</h3>
          <div className="p-4 bg-gray-50 rounded-lg border">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Naturaleza:</span>
                <p className="text-lg font-black text-primary">{isInasistencia ? `FALTA: ${permit.eventuality}` : permit.action}</p>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Periodo:</span>
                <p className="font-bold">
                  {permit.startDate === permit.endDate 
                    ? format(parseISO(permit.startDate), "dd 'de' MMMM, yyyy", { locale: es })
                    : `Del ${format(parseISO(permit.startDate), "dd/MM/yyyy")} al ${format(parseISO(permit.endDate), "dd/MM/yyyy")}`}
                </p>
              </div>
            </div>
            
            <div className="mb-4">
              <span className="text-gray-500 block text-[10px] uppercase font-bold">Justificación del Colaborador:</span>
              <p className="italic text-sm leading-relaxed mt-1">"{permit.justification}"</p>
            </div>

            {permit.evidence && (
              <div className="pt-2 border-t border-dashed mt-2">
                <span className="text-gray-500 block text-[10px] uppercase font-bold flex items-center gap-1">
                  <FileSearch className="h-3 w-3" /> Evidencia Presentada:
                </span>
                <p className="text-xs font-bold text-zinc-700">{permit.evidence}</p>
              </div>
            )}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-black uppercase border-b mb-4 text-gray-600 tracking-widest">III. Resolución RRHH</h3>
          <div className={`p-6 rounded-xl border-2 flex items-center gap-6 ${permit.status === 'approved' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            {permit.status === 'approved' ? <CheckCircle2 className="h-12 w-12 text-green-600" /> : <XCircle className="h-12 w-12 text-red-600" />}
            <div className="flex-1">
              <span className="text-[10px] uppercase font-black text-gray-500">Dictamen Final:</span>
              <p className={`text-xl font-black ${permit.status === 'approved' ? 'text-green-700' : 'text-red-700'}`}>
                {getStatusLabel(permit.status)}
              </p>
              {permit.adminNotes && (
                <div className="mt-2 text-sm">
                  <span className="font-bold">Observaciones de Administración:</span>
                  <p className="text-gray-700">{permit.adminNotes}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Firmas */}
        <div className="pt-16 grid grid-cols-3 gap-8">
          <div className="text-center">
            <div className="border-t border-black pt-2">
              <p className="text-[10px] font-bold uppercase">{permit.employeeName}</p>
              <p className="text-[9px] text-gray-500 uppercase">Colaborador</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-black pt-2">
              <p className="text-[10px] font-bold uppercase">{permit.supervisorName}</p>
              <p className="text-[9px] text-gray-500 uppercase">Visto Bueno Jefe</p>
              <p className="text-[8px] italic">{permit.approvedBySupervisorAt ? format(parseISO(permit.approvedBySupervisorAt), "dd/MM/yyyy HH:mm") : ''}</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-black pt-2">
              <p className="text-[10px] font-bold uppercase">{permit.approvedByAdminName || 'ADMINISTRACIÓN'}</p>
              <p className="text-[9px] text-gray-500 uppercase">Resolución RRHH</p>
              <p className="text-[8px] italic">{permit.approvedByAdminAt ? format(parseISO(permit.approvedByAdminAt), "dd/MM/yyyy HH:mm") : ''}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-20 pt-4 border-t text-[8px] text-center text-gray-400 uppercase tracking-widest">
        Documento generado electrónicamente por Flynet Business System. Sistema de Gestión RRHH.
      </div>
    </div>
  );
}
