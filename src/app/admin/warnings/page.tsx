'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Gavel, PlusCircle, Loader2, Download, Trash2, FileText, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Employee, WarningRecord } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { WarningDialog } from '@/components/admin/warning-dialog';
import { WarningPdfTemplate } from '@/components/admin/warning-pdf-template';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Input } from '@/components/ui/input';

export default function AdminWarningsPage() {
  const [warnings, setWarnings] = useState<WarningRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  // Estado para PDF
  const [printingWarning, setPrintingWarning] = useState<WarningRecord | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [warnRes, empRes] = await Promise.all([
        fetch('/api/admin/warnings'),
        fetch('/api/employees')
      ]);
      if (warnRes.ok) setWarnings(await warnRes.json());
      if (empRes.ok) setEmployees(await empRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta amonestación del historial?')) return;
    try {
      const res = await fetch('/api/admin/warnings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        toast({ title: "Registro eliminado" });
        fetchData();
      }
    } catch (e) {}
  };

  const handleDownloadPdf = async (warning: WarningRecord) => {
    setPrintingWarning(warning);
    setTimeout(async () => {
      if (!pdfRef.current) return;
      try {
        const pageElement = pdfRef.current.querySelector('.pdf-page') as HTMLElement;
        const canvas = await html2canvas(pageElement, { scale: 2 });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Amonestacion_${warning.employeeName.replace(/ /g, '_')}.pdf`);
        toast({ title: "PDF Generado" });
      } catch (error) {
        console.error(error);
      } finally {
        setPrintingWarning(null);
      }
    }, 500);
  };

  const filteredWarnings = warnings.filter(w => 
    w.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
            <Gavel className="h-6 w-6 text-primary" />
            Expediente Disciplinario
          </h1>
          <p className="text-muted-foreground text-sm">Registro de amonestaciones escritas basadas en el Código de Trabajo.</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="gap-2 shadow-lg">
          <PlusCircle className="h-4 w-4" /> Generar Amonestación
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg">Historial de Medidas Disciplinarias</CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar empleado..." 
                className="pl-8 h-9" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filteredWarnings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha Emisión</TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Fecha de la Falta</TableHead>
                  <TableHead>DUI Registrado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWarnings.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>{format(parseISO(w.date), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-bold">{w.employeeName}</TableCell>
                    <TableCell>{format(parseISO(w.incidentDate), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-mono text-xs">{w.dui}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleDownloadPdf(w)}>
                          <Download className="h-3 w-3" /> Descargar PDF
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(w.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-20 text-muted-foreground italic">
              No hay amonestaciones registradas en el sistema.
            </div>
          )}
        </CardContent>
      </Card>

      <WarningDialog 
        employees={employees}
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSaved={fetchData}
      />

      {/* CONTENEDOR OCULTO PARA PDF */}
      <div className="fixed top-[-9999px] left-[-9999px]">
        <div ref={pdfRef}>
          {printingWarning && <WarningPdfTemplate warning={printingWarning} />}
        </div>
      </div>
    </div>
  );
}
