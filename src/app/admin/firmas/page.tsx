'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { PdfViewer } from '@/components/ui/pdf-viewer';
import { months } from '@/lib/data';
import {
  FileSignature,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Send,
  RefreshCw,
  Search,
  Loader2,
  FileBadge,
  UserCheck,
  Bell,
  Download,
} from 'lucide-react';

type FirmaRow = {
  id: number;
  name: string;
  branch: string;
  email: string | null;
  enrolled: boolean;
  hasReceipt: boolean;
  signed: boolean;
  signedAt: string | null;
  rubricaPath: string | null;
};

type Summary = {
  total: number;
  conRecibo: number;
  enrolados: number;
  firmados: number;
  pendientes: number;
};

const years = [2025, 2026, 2027];

export default function FirmasPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(months[new Date().getMonth()]);
  const [selectedQuincena, setSelectedQuincena] = useState('1');
  const [rows, setRows] = useState<FirmaRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);

  const { toast } = useToast();

  const fetchEstado = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/admin/firmas/estado?year=${selectedYear}&month=${selectedMonth}&quincena=${selectedQuincena}`
      );
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setRows(data.rows || []);
      setSummary(data.summary || null);
    } catch (e) {
      console.error(e);
      setRows([]);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEstado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth, selectedQuincena]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.id.toString().includes(q));
  }, [rows, searchTerm]);

  const buildViewUrl = (row: FirmaRow) =>
    `/api/admin/pay-stubs/view?year=${selectedYear}&month=${selectedMonth}&quincena=${selectedQuincena}&employee=${encodeURIComponent(row.name)}`;

  const buildDownloadName = (employeeName: string) =>
    `Recibo_${employeeName.replace(/[^a-z0-9]/gi, '_')}_${selectedMonth}_${selectedYear}_Q${selectedQuincena}.pdf`;

  const openPreview = (row: FirmaRow) => {
    setPreview({ name: row.name, url: buildViewUrl(row) });
  };

  const sendReminder = async (employeeName: string | null) => {
    if (employeeName) setSending(employeeName);
    else setSendingAll(true);

    try {
      const res = await fetch('/api/admin/firmas/recordatorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: selectedYear,
          month: selectedMonth,
          quincena: selectedQuincena,
          employeeNames: employeeName ? [employeeName] : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: 'Recordatorios enviados',
          description: `Notificados ${data.count} empleado(s). Correos entregados: ${data.emailDelivered ?? 0}.`,
        });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: data.error || 'No se pudo enviar' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar el recordatorio' });
    } finally {
      setSending(null);
      setSendingAll(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSignature className="h-6 w-6 text-primary" />
            Control de Firmas
          </h1>
          <p className="text-muted-foreground text-sm">
            Revisa quién ya firmó su recibo, visualiza el PDF firmado y envía recordatorios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Card className="flex items-center p-1 bg-muted/20 gap-2 border-primary/10">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[90px] h-8 text-xs border-none bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="w-[1px] h-4 bg-muted-foreground/20" />
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[110px] h-8 text-xs border-none bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="w-[1px] h-4 bg-muted-foreground/20" />
            <Select value={selectedQuincena} onValueChange={setSelectedQuincena}>
              <SelectTrigger className="w-[110px] h-8 text-xs border-none bg-transparent">
                <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> <SelectValue /></div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1ra Quincena</SelectItem>
                <SelectItem value="2">2da Quincena</SelectItem>
              </SelectContent>
            </Select>
          </Card>

          <Button size="icon" variant="ghost" className="h-10 w-10" onClick={fetchEstado} title="Recargar">
            <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </Button>

          <Button
            className="h-10 gap-2"
            onClick={() => sendReminder(null)}
            disabled={sendingAll || !summary?.pendientes}
          >
            {sendingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            Enviar recordatorios ({summary?.pendientes ?? 0})
          </Button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-primary/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileBadge className="h-8 w-8 text-primary" />
              <div>
                <div className="text-2xl font-bold">{summary?.conRecibo ?? 0}</div>
                <div className="text-xs text-muted-foreground">Con recibo</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <div className="text-2xl font-bold text-green-600">{summary?.firmados ?? 0}</div>
                <div className="text-xs text-muted-foreground">Firmados</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-amber-600" />
              <div>
                <div className="text-2xl font-bold text-amber-600">{summary?.pendientes ?? 0}</div>
                <div className="text-xs text-muted-foreground">Pendientes</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <UserCheck className="h-8 w-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-blue-600">{summary?.enrolados ?? 0}</div>
                <div className="text-xs text-muted-foreground">Con firma activa</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla */}
      <Card className="border-2">
        <CardHeader className="pb-3 border-b bg-muted/10">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg">Empleados</CardTitle>
            <div className="relative flex-1 max-w-[240px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empleado..."
                className="pl-8 h-9 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>Consultando estado de firmas...</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[600px]">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-[60px]">ID</TableHead>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Recibo</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Fecha de firma</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.id}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="text-sm">{row.name}</span>
                          <span className="text-[9px] text-muted-foreground uppercase font-bold">
                            {row.branch}
                            {row.email ? ` · ${row.email}` : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.hasReceipt ? (
                          <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-700 border-blue-100">
                            <CheckCircle2 className="h-3 w-3" /> Subido
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 opacity-40">
                            <XCircle className="h-3 w-3" /> Sin recibo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.signed ? (
                          <Badge variant="secondary" className="gap-1 bg-green-50 text-green-700 border-green-100">
                            <CheckCircle2 className="h-3 w-3" /> Firmado
                          </Badge>
                        ) : row.enrolled ? (
                          <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-200">
                            <Clock className="h-3 w-3" /> Pendiente
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 opacity-50">
                            No enrolado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.signedAt ? new Date(row.signedAt).toLocaleString('es-SV') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {row.hasReceipt && (
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openPreview(row)} title="Ver PDF firmado">
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {row.hasReceipt && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" asChild title="Descargar PDF firmado">
                              <a href={buildViewUrl(row)} download={buildDownloadName(row.name)}>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {row.hasReceipt && !row.signed && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-primary"
                              onClick={() => sendReminder(row.name)}
                              disabled={sending === row.name}
                              title="Enviar recordatorio"
                            >
                              {sending === row.name ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
        </CardContent>
      </Card>

      {/* Vista previa del PDF firmado */}
      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between pr-12">
            <DialogTitle className="flex items-center gap-2">
              <FileBadge className="h-5 w-5 text-primary" />
              {preview?.name} · {selectedMonth} {selectedYear} (Q{selectedQuincena})
            </DialogTitle>
            {preview && (
              <a
                href={preview.url}
                download={buildDownloadName(preview.name)}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              >
                <Download className="h-3.5 w-3.5" /> Descargar PDF
              </a>
            )}
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {preview && <PdfViewer file={preview.url} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
