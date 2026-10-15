'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FolderArchive,
  Loader2,
  FileText,
  Download,
  Trash2,
  Search,
  User,
  Calendar,
  Eye,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  Filter,
  FileDown,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { Employee, HistoryEntry } from '@/lib/types';
import { format, isValid, parseISO } from 'date-fns';
import { normalizeEmployeeName } from '@/lib/record-utils';
import {
  groupHistoryByEmployee,
  isPendingPermit,
  permitStatusClasses,
  permitStatusLabel,
  type HistoryEmployeeGroup,
} from '@/lib/history-utils';
import { HistoryViewerDialog, fmtHistoryDate } from '@/components/history/history-viewer-dialog';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function Kpi({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: any;
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-2 flex items-center gap-2">
        <div className={`p-1.5 rounded-md ${className || 'bg-primary/10 text-primary'}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground truncate">{label}</p>
          <p className="text-base font-black leading-none">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminHistoryPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [viewing, setViewing] = useState<HistoryEntry | null>(null);
  const { toast } = useToast();

  /** Historial consolidado: documentos del expediente + permisos del colaborador. */
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [empRes, histRes] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/history?consolidated=1'),
      ]);
      if (empRes.ok) setEmployees(await empRes.json());
      if (histRes.ok) {
        const data = await histRes.json();
        setEntries(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este documento del historial del colaborador?')) return;
    try {
      const res = await fetch('/api/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        toast({ title: 'Documento eliminado' });
        setEntries((prev) => prev.filter((e) => !(e.kind === 'document' && e.id === id)));
      } else {
        toast({ variant: 'destructive', title: 'No se pudo eliminar' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error al eliminar' });
    }
  };

  // --- KPIs (sobre el historial completo, sin filtros) ---
  const kpis = useMemo(() => {
    const permisos = entries.filter((e) => e.kind === 'permit');
    return {
      total: entries.length,
      documentos: entries.filter((e) => e.kind === 'document').length,
      permisos: permisos.length,
      pendientes: permisos.filter((p) => isPendingPermit(p.status)).length,
      colaboradores: new Set(entries.map((e) => normalizeEmployeeName(e.employeeName))).size,
    };
  }, [entries]);

  /** Meses disponibles en el historial, del más reciente al más antiguo. */
  const monthOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) {
      const d = parseISO(e.date);
      if (!isValid(d)) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      map.set(key, `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`);
    }
    return Array.from(map.entries())
      .sort((a, b) => {
        const [ya, ma] = a[0].split('-').map(Number);
        const [yb, mb] = b[0].split('-').map(Number);
        return yb - ya || mb - ma;
      })
      .map(([key, label]) => ({ value: key, label }));
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (kindFilter !== 'all' && e.kind !== kindFilter) return false;

      if (statusFilter !== 'all') {
        if (e.kind !== 'permit') return false;
        if (statusFilter === 'pending') {
          if (!isPendingPermit(e.status)) return false;
        } else if (e.status !== statusFilter) {
          return false;
        }
      }

      if (monthFilter !== 'all') {
        const d = parseISO(e.date);
        if (!isValid(d) || `${d.getFullYear()}-${d.getMonth()}` !== monthFilter) return false;
      }

      if (selectedEmployee !== 'all' && normalizeEmployeeName(e.employeeName) !== normalizeEmployeeName(selectedEmployee)) {
        return false;
      }

      const q = searchTerm.trim().toLowerCase();
      if (q) {
        const haystack = [e.employeeName, e.title, e.detail, e.notes, e.justification, e.branch, e.position]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [entries, kindFilter, statusFilter, monthFilter, selectedEmployee, searchTerm]);

  const groups: HistoryEmployeeGroup[] = useMemo(() => groupHistoryByEmployee(filtered), [filtered]);

  const isOpen = useCallback(
    (group: HistoryEmployeeGroup) => {
      const key = normalizeEmployeeName(group.employeeName);
      if (collapsed[key] !== undefined) return !collapsed[key];
      // Por defecto: abierto si hay pocos colaboradores en pantalla o si se filtró por uno.
      return selectedEmployee !== 'all' || groups.length <= 2;
    },
    [collapsed, groups.length, selectedEmployee]
  );

  const toggle = (group: HistoryEmployeeGroup) => {
    const key = normalizeEmployeeName(group.employeeName);
    const currentlyOpen = isOpen(group);
    setCollapsed((prev) => ({ ...prev, [key]: currentlyOpen }));
  };

  /** Marca todos los grupos como contraídos o expandidos. */
  const setAllCollapsed = (value: boolean) => {
    const next: Record<string, boolean> = {};
    for (const g of groups) next[normalizeEmployeeName(g.employeeName)] = value;
    setCollapsed(next);
  };

  const clearFilters = () => {
    setSelectedEmployee('all');
    setKindFilter('all');
    setStatusFilter('all');
    setMonthFilter('all');
    setSearchTerm('');
  };

  const hasFilters =
    selectedEmployee !== 'all' || kindFilter !== 'all' || statusFilter !== 'all' || monthFilter !== 'all' || !!searchTerm.trim();

  const filterSummary = [
    `Colaborador: ${selectedEmployee === 'all' ? 'Todos' : selectedEmployee}`,
    `Tipo: ${kindFilter === 'all' ? 'Documentos y permisos' : kindFilter === 'permit' ? 'Solo permisos' : 'Solo documentos'}`,
    `Estado: ${statusFilter === 'all' ? 'Cualquiera' : statusFilter === 'pending' ? 'Pendientes' : statusFilter === 'approved' ? 'Aprobados' : 'Rechazados'}`,
    `Periodo: ${monthFilter === 'all' ? 'Todo' : monthOptions.find((m) => m.value === monthFilter)?.label || monthFilter}`,
    searchTerm.trim() ? `Búsqueda: "${searchTerm.trim()}"` : null,
  ]
    .filter(Boolean)
    .join('  |  ');

  /**
   * Exporta el historial a Excel.
   * Cada entrada con archivo (documento del expediente o justificante de permiso)
   * lleva un enlace clicable para abrirlo desde el propio Excel.
   */
  const handleExport = useCallback(async () => {
    if (filtered.length === 0) return;
    setIsExporting(true);

    try {
      const workbook = new ExcelJS.Workbook();
      const blueHeader = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF0070C0' } };
      const amberHeader = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFC000' } };
      const greyFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF2F2F2' } };
      const whiteBold = { color: { argb: 'FFFFFFFF' }, bold: true };
      const bold = { bold: true };
      const linkFont = { color: { argb: 'FF0563C1' }, underline: true as const };
      const origin = typeof window !== 'undefined' ? window.location.origin : '';

      // ---------- Hoja 1: resumen por colaborador ----------
      const resumen = workbook.addWorksheet('Resumen por Colaborador');
      resumen.addRow(['HISTORIAL DEL COLABORADOR - RESUMEN']).font = { size: 14, bold: true };
      resumen.addRow([`Generado el ${format(new Date(), 'dd/MM/yyyy HH:mm')}  |  ${groups.length} colaborador(es)  |  ${filtered.length} entrada(s)`]).font = {
        size: 9,
        italic: true,
        color: { argb: 'FF666666' },
      };
      resumen.addRow([`Filtros -> ${filterSummary}`]).font = { size: 9, italic: true, color: { argb: 'FF666666' } };
      resumen.addRow([]);

      const h1 = resumen.addRow([
        'Colaborador', 'Sucursal', 'Documentos', 'Permisos', 'Pendientes', 'Aprobados', 'Rechazados', 'Último movimiento',
      ]);
      h1.eachCell((c) => {
        c.fill = amberHeader;
        c.font = bold;
      });

      for (const g of groups) {
        resumen.addRow([
          g.employeeName,
          g.branch || '—',
          g.documents,
          g.permits,
          g.pending,
          g.approved,
          g.rejected,
          g.lastDate ? fmtHistoryDate(g.lastDate) : '—',
        ]);
      }

      const totalRow = resumen.addRow([
        `TOTAL (${groups.length} colaboradores)`,
        '',
        groups.reduce((s, g) => s + g.documents, 0),
        groups.reduce((s, g) => s + g.permits, 0),
        groups.reduce((s, g) => s + g.pending, 0),
        groups.reduce((s, g) => s + g.approved, 0),
        groups.reduce((s, g) => s + g.rejected, 0),
        '',
      ]);
      totalRow.eachCell((c) => {
        c.fill = greyFill;
        c.font = bold;
      });
      resumen.columns = [
        { width: 32 }, { width: 16 }, { width: 12 }, { width: 11 }, { width: 12 }, { width: 11 }, { width: 12 }, { width: 18 },
      ];
      resumen.views = [{ state: 'frozen', ySplit: 5 }];

      // ---------- Hoja 2: detalle ----------
      const detalle = workbook.addWorksheet('Detalle');
      detalle.addRow(['HISTORIAL DEL COLABORADOR - DETALLE']).font = { size: 14, bold: true };
      detalle.addRow([`${filtered.length} entrada(s)  |  ${filterSummary}`]).font = {
        size: 9,
        italic: true,
        color: { argb: 'FF666666' },
      };
      detalle.addRow([]);

      const detalleCols = [
        'Colaborador', 'Sucursal', 'Origen', 'Fecha', 'Concepto', 'Detalle', 'Estado', 'Justificación / Notas', 'Archivo',
      ];
      const h2 = detalle.addRow(detalleCols);
      h2.eachCell((c) => {
        c.fill = blueHeader;
        c.font = whiteBold;
      });

      const ARCHIVO_COL = detalleCols.length;

      // Orden estable: por colaborador y luego por fecha descendente.
      const ordered = [...groups].flatMap((g) =>
        g.entries.map((entry) => ({ group: g, entry }))
      );

      for (const { group, entry } of ordered) {
        const row = detalle.addRow([
          group.employeeName,
          group.branch || entry.branch || '—',
          entry.kind === 'permit' ? 'Permiso' : 'Documento',
          fmtHistoryDate(entry.date),
          entry.title,
          entry.detail,
          entry.kind === 'permit' ? permitStatusLabel(entry.status) : 'En expediente',
          [entry.justification, entry.notes].filter(Boolean).join(' · '),
          '',
        ]);

        // Enlace directo al archivo (documento o justificante del permiso)
        const fileCell = row.getCell(ARCHIVO_COL);
        if (entry.hasFile && entry.fileUrl) {
          fileCell.value = {
            text: entry.kind === 'permit' ? 'Abrir justificante' : 'Abrir documento',
            hyperlink: `${origin}${entry.fileUrl}`,
          };
          fileCell.font = linkFont;
        } else {
          fileCell.value = '—';
        }

        row.getCell(6).alignment = { wrapText: true, vertical: 'top' };
        row.getCell(8).alignment = { wrapText: true, vertical: 'top' };
      }

      detalle.columns = [
        { width: 30 }, { width: 14 }, { width: 11 }, { width: 12 }, { width: 34 }, { width: 26 }, { width: 20 }, { width: 46 }, { width: 20 },
      ];
      detalle.views = [{ state: 'frozen', xSplit: 1, ySplit: 4 }];

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(
        new Blob([buffer]),
        `Historial_Colaboradores_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`
      );
      toast({ title: 'Excel generado', description: `${filtered.length} entrada(s) exportadas.` });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al exportar' });
    } finally {
      setIsExporting(false);
    }
  }, [filtered, groups, filterSummary, toast]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-1.5">
        <Kpi icon={Users} label="Colaboradores" value={kpis.colaboradores} />
        <Kpi icon={ClipboardList} label="Entradas" value={kpis.total} />
        <Kpi icon={FolderArchive} label="Documentos" value={kpis.documentos} />
        <Kpi icon={FileText} label="Permisos" value={kpis.permisos} />
        <Kpi
          icon={Clock}
          label="Permisos pendientes"
          value={kpis.pendientes}
          className="bg-amber-100 text-amber-700"
        />
      </div>

      <Card>
        <CardHeader className="p-1.5 space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar colaborador, permiso, documento, justificación..."
                className="pl-7 h-8 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-full md:w-56 h-8 text-xs">
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-primary" />
                  <SelectValue placeholder="Colaborador" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los colaboradores</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.name}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="w-full md:w-40 h-8 text-xs">
                <div className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-primary" />
                  <SelectValue placeholder="Tipo" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Documentos y permisos</SelectItem>
                <SelectItem value="permit">Solo permisos</SelectItem>
                <SelectItem value="document">Solo documentos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-36 h-8 text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Cualquier estado</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="approved">Aprobados</SelectItem>
                <SelectItem value="rejected">Rechazados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-full md:w-36 h-8 text-xs">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <SelectValue placeholder="Periodo" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el periodo</SelectItem>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] text-muted-foreground px-0.5">
              {filtered.length} entrada(s) en {groups.length} colaborador(es)
              {hasFilters && ' (filtrado)'}
            </p>
            <div className="flex items-center gap-1">
              {hasFilters && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setAllCollapsed(false)}>
                <ChevronDown className="h-3 w-3" /> Expandir
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setAllCollapsed(true)}>
                <ChevronRight className="h-3 w-3" /> Contraer
              </Button>
              <Button
                size="sm"
                className="h-7 px-2 text-[11px] gap-1 bg-green-600 hover:bg-green-700 text-white border-none shadow-sm"
                onClick={handleExport}
                disabled={isExporting || filtered.length === 0}
              >
                {isExporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
                Exportar Excel
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-1.5 pt-0 space-y-1.5">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground italic">
              No hay entradas en el historial con los filtros actuales.
            </div>
          ) : (
            groups.map((group) => {
              const open = isOpen(group);
              return (
                <div key={normalizeEmployeeName(group.employeeName)} className="rounded-lg border shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggle(group)}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1 text-left hover:bg-muted/40 transition-colors rounded-t-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {open ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-[10px] shrink-0">
                        {group.employeeName.substring(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-[12px] truncate leading-tight">{group.employeeName}</p>
                        <p className="text-[9px] text-muted-foreground font-medium truncate leading-tight">
                          {group.branch || 'Sin sucursal'}
                          {group.lastDate ? ` · último ${fmtHistoryDate(group.lastDate)}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                      <Badge variant="outline" className="text-[9px] h-4 px-1 gap-1 bg-zinc-50">
                        <FolderArchive className="h-2.5 w-2.5" /> {group.documents}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] h-4 px-1 gap-1 bg-blue-50 text-blue-700 border-blue-200">
                        <FileText className="h-2.5 w-2.5" /> {group.permits}
                      </Badge>
                      {group.pending > 0 && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 gap-1 bg-amber-50 text-amber-700 border-amber-200">
                          <Clock className="h-2.5 w-2.5" /> {group.pending}
                        </Badge>
                      )}
                      {group.approved > 0 && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 gap-1 bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-2.5 w-2.5" /> {group.approved}
                        </Badge>
                      )}
                      {group.rejected > 0 && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 gap-1 bg-red-50 text-red-700 border-red-200">
                          <XCircle className="h-2.5 w-2.5" /> {group.rejected}
                        </Badge>
                      )}
                    </div>
                  </button>

                  {open && (
                    <div className="overflow-x-auto border-t">
                      <Table className="text-[11px] [&_th]:h-6 [&_th]:px-1.5 [&_th]:py-0 [&_th]:text-[9px] [&_td]:px-1.5 [&_td]:py-0.5">
                        <TableHeader className="bg-muted/40">
                          <TableRow>
                            <TableHead className="w-[92px]">Origen</TableHead>
                            <TableHead className="w-[92px]">Fecha</TableHead>
                            <TableHead>Detalle</TableHead>
                            <TableHead className="w-[150px]">Estado</TableHead>
                            <TableHead className="text-right w-[150px]">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.entries.map((entry) => (
                            <TableRow
                              key={`${entry.kind}-${entry.id}`}
                              className="hover:bg-muted/30 transition-colors align-top"
                            >
                              <TableCell>
                                {entry.kind === 'permit' ? (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 gap-1 bg-blue-50 text-blue-700 border-blue-200">
                                    <FileText className="h-2.5 w-2.5" /> Permiso
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 gap-1 bg-zinc-50">
                                    <FolderArchive className="h-2.5 w-2.5" /> Documento
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-[10px] font-bold whitespace-nowrap leading-tight">
                                {fmtHistoryDate(entry.date)}
                                <span className="block text-[8px] font-medium text-muted-foreground">
                                  {entry.kind === 'permit' ? 'solicitado' : 'cargado'}
                                </span>
                              </TableCell>
                              <TableCell className="max-w-[520px] leading-tight">
                                <p className="text-[11px] font-bold text-zinc-800">{entry.title}</p>
                                <p className="text-[9px] text-muted-foreground">{entry.detail}</p>
                                {entry.justification && (
                                  <p className="text-[9px] text-zinc-500 italic line-clamp-2">“{entry.justification}”</p>
                                )}
                                {entry.notes && (
                                  <p className="text-[9px] text-zinc-500 italic line-clamp-2">Notas: {entry.notes}</p>
                                )}
                              </TableCell>
                              <TableCell>
                                {entry.kind === 'permit' ? (
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] h-4 px-1 ${permitStatusClasses(entry.status)}`}
                                  >
                                    {permitStatusLabel(entry.status)}
                                  </Badge>
                                ) : (
                                  <span className="text-[9px] text-muted-foreground">En expediente</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-0.5">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-1.5 text-[10px] gap-1"
                                    onClick={() => setViewing(entry)}
                                  >
                                    <Eye className="h-3 w-3" /> Ver
                                  </Button>
                                  {entry.hasFile && entry.fileUrl && (
                                    <Button variant="outline" size="icon" className="h-6 w-6" asChild>
                                      <a
                                        href={entry.fileUrl}
                                        download={entry.fileName || undefined}
                                        title="Descargar archivo"
                                      >
                                        <Download className="h-3 w-3" />
                                      </a>
                                    </Button>
                                  )}
                                  {entry.kind === 'document' && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                      onClick={() => handleDelete(entry.id)}
                                      title="Eliminar documento"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <HistoryViewerDialog entry={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
