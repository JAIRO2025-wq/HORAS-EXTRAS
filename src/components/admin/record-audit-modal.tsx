'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import type { OvertimeRecord, AuditEntry } from '@/lib/types';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ShieldCheck, Copy, Check, UserCheck, Pencil, Clock, History,
  ArrowRight, FileText, Lock, Info,
} from 'lucide-react';

interface AuditModalProps {
  record: OvertimeRecord | null;
  isOpen: boolean;
  onClose: () => void;
  adminRole: string; // ADMIN_1 (Control) | ADMIN_2 (Gerencia)
}

function safeFormat(iso?: string, pattern = 'dd/MM/yyyy HH:mm') {
  if (!iso) return '—';
  const d = parseISO(iso);
  return isValid(d) ? format(d, pattern, { locale: es }) : iso;
}

/**
 * Formatea la fecha laboral, que puede venir como Date o como string ISO.
 * Ej: "domingo 12 de sep 2026"
 */
function formatLaborDate(date: Date | string | undefined): string {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return format(d, "EEEE dd 'de' MMM yyyy", { locale: es });
}

function actionLabel(action: AuditEntry['action']) {
  switch (action) {
    case 'created': return 'Creó el registro';
    case 'approved': return 'Aprobó';
    case 'rejected': return 'Rechazó';
    case 'pending': return 'Devolvió a Pendiente';
    case 'deleted': return 'Eliminó';
    default: return 'Editó';
  }
}

function actionColor(action: AuditEntry['action']) {
  switch (action) {
    case 'approved': return 'bg-green-100 text-green-800 border-green-200';
    case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
    case 'created': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200';
    default: return 'bg-zinc-100 text-zinc-700 border-zinc-200';
  }
}

function roleLabel(role?: string) {
  if (role === 'ADMIN_1') return 'Control';
  if (role === 'ADMIN_2') return 'Gerencia';
  return role || '—';
}

export function RecordAuditModal({ record, isOpen, onClose, adminRole }: AuditModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const isControl = adminRole === 'ADMIN_1';

  if (!record) return null;

  const auditLog = record.auditLog || [];

  /**
   * Construye el texto plano ordenado para copiar al portapapeles.
   */
  const buildCopyText = () => {
    const lines: string[] = [];
    lines.push('=== AUDITORÍA DE REGISTRO DE HORAS EXTRA ===');
    lines.push('');
    lines.push(`Empleado: ${record.employeeName || '—'}`);
    lines.push(`Fecha laboral: ${formatLaborDate(record.date)}`);
    lines.push(`Horario: ${record.startTime} - ${record.endTime}`);
    lines.push(`Horas totales: ${(record.totalHours || 0).toFixed(2)} h`);
    lines.push(`Tipo: ${record.type === 'additional_day' ? 'Día Adicional' : 'Horas Extra'}`);
    lines.push(`Estado: ${record.status === 'approved' ? 'Aprobado' : record.status === 'rejected' ? 'Rechazado' : 'Pendiente'}`);
    lines.push('');
    lines.push('--- APROBACIÓN ---');
    lines.push(`Aprobado/Rechazado por: ${record.approvedBy || '—'}`);
    lines.push(`Rol: ${roleLabel(record.approvedByRole)}`);
    lines.push(`Fecha: ${safeFormat(record.approvedAt)}`);
    lines.push('');

    if (isControl) {
      lines.push('--- ÚLTIMA EDICIÓN ---');
      lines.push(`Editado por: ${record.lastEditedBy || '—'}`);
      lines.push(`Rol: ${roleLabel(record.lastEditedByRole)}`);
      lines.push(`Fecha: ${safeFormat(record.lastEditedAt)}`);
      lines.push('');
      lines.push('--- HISTORIAL DE CAMBIOS ---');
      if (auditLog.length === 0) {
        lines.push('(Sin historial registrado)');
      } else {
        auditLog.forEach((entry, i) => {
          lines.push('');
          lines.push(`[${i + 1}] ${actionLabel(entry.action)} — ${entry.adminName} (${roleLabel(entry.adminRole)})`);
          lines.push(`    Fecha: ${safeFormat(entry.timestamp)}`);
          if (entry.changes.length > 0) {
            entry.changes.forEach(c => {
              lines.push(`    • ${c.label}: "${c.before}" → "${c.after}"`);
            });
          }
        });
      }
    }

    lines.push('');
    lines.push(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: es })}`);
    return lines.join('\n');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildCopyText());
      setCopied(true);
      toast({ title: 'Copiado', description: 'La auditoría se copió al portapapeles.' });
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo copiar.' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Auditoría del Registro
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{record.employeeName}</span>
              <Badge variant="outline" className="text-[10px]">
                {isControl ? 'Vista Control (completa)' : 'Vista Gerencia'}
              </Badge>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* RESUMEN DEL REGISTRO */}
          <div className="bg-muted/30 rounded-xl border p-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3 w-3" /> Datos del Registro
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Fecha laboral</p>
                <p className="font-bold capitalize">{formatLaborDate(record.date)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Horario</p>
                <p className="font-bold font-mono">{record.startTime} - {record.endTime}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Horas</p>
                <p className="font-bold">{(record.totalHours || 0).toFixed(2)} h</p>
              </div>
              <div>
                <p className="text-muted-foreground">Quincena</p>
                <p className="font-bold">Q{record.quincena}</p>
              </div>
            </div>
          </div>

          {/* APROBACIÓN — visible para ambos roles */}
          <div className="rounded-xl border border-green-200 bg-green-50/50 p-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-green-800 flex items-center gap-1.5">
              <UserCheck className="h-3 w-3" /> Aprobación
            </p>
            {record.approvedBy ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Aprobado / Rechazado por</p>
                  <p className="font-bold">{record.approvedBy}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Rol</p>
                  <p className="font-bold">{roleLabel(record.approvedByRole)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fecha</p>
                  <p className="font-bold">{safeFormat(record.approvedAt)}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Este registro aún no ha sido aprobado ni rechazado.
              </p>
            )}
          </div>

          {/* SECCIÓN EXCLUSIVA DE CONTROL */}
          {isControl ? (
            <>
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-800 flex items-center gap-1.5">
                  <Pencil className="h-3 w-3" /> Última Edición
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Editado por</p>
                    <p className="font-bold">{record.lastEditedBy || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Rol</p>
                    <p className="font-bold">{roleLabel(record.lastEditedByRole)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fecha</p>
                    <p className="font-bold">{safeFormat(record.lastEditedAt)}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <History className="h-3 w-3" /> Historial de Cambios ({auditLog.length})
                </p>

                {auditLog.length > 0 ? (
                  <div className="space-y-3">
                    {[...auditLog].reverse().map((entry, i) => (
                      <div key={i} className="border rounded-xl p-3 space-y-2 bg-card">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge className={`${actionColor(entry.action)} text-[10px]`}>
                              {actionLabel(entry.action)}
                            </Badge>
                            <span className="text-xs font-bold">{entry.adminName}</span>
                            <Badge variant="outline" className="text-[9px]">
                              {roleLabel(entry.adminRole)}
                            </Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {safeFormat(entry.timestamp)}
                          </span>
                        </div>

                        {entry.changes.length > 0 && (
                          <div className="space-y-1 pl-1">
                            {entry.changes.map((c, j) => (
                              <div key={j} className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                <span className="font-bold text-muted-foreground">{c.label}:</span>
                                <span className="line-through text-red-600/80">{c.before}</span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span className="font-bold text-green-700">{c.after}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-xs italic border-2 border-dashed rounded-xl">
                    <Info className="h-6 w-6 mx-auto mb-2 opacity-20" />
                    Sin historial de cambios registrado para este registro.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed bg-muted/20 p-4 flex items-start gap-3">
              <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                El detalle de ediciones, el historial de cambios y las horas modificadas
                están disponibles únicamente para el rol <strong>Control</strong>.
              </p>
            </div>
          )}

          {/* BOTÓN COPIAR */}
          <Button
            onClick={handleCopy}
            variant={copied ? 'secondary' : 'default'}
            className="w-full h-11 gap-2 font-bold"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado al portapapeles' : 'Copiar Auditoría Completa'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
