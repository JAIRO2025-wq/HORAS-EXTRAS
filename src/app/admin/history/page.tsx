'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  X,
  Eye,
  FileBadge
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
import type { Employee, EmployeeHistoryRecord } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { PdfViewer } from '@/components/ui/pdf-viewer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function AdminHistoryPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<EmployeeHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingDoc, setViewingDoc] = useState<EmployeeHistoryRecord | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [empRes, histRes] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/history')
      ]);
      if (empRes.ok) setEmployees(await empRes.json());
      if (histRes.ok) setRecords(await histRes.json());
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
    if (!confirm('¿Eliminar este documento del historial oficial?')) return;
    try {
      const res = await fetch('/api/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        toast({ title: 'Documento Eliminado' });
        fetchData();
      }
    } catch (e) {}
  };

  const filteredRecords = records.filter(r => {
    const matchEmp = selectedEmployee === 'all' || r.employeeName === selectedEmployee;
    const matchSearch = r.documentType.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      r.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchEmp && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
            <FolderArchive className="h-6 w-6 text-primary" />
            Expediente Digital de Colaboradores
          </h1>
          <p className="text-muted-foreground text-sm">Consulta de permanencias ISSS, títulos y documentos legales del personal.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por tipo de documento o nombre..." 
                className="pl-8 h-10" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-full md:w-72 h-10 font-bold">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <SelectValue placeholder="Filtrar por empleado" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los empleados</SelectItem>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filteredRecords.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Tipo de Documento</TableHead>
                    <TableHead>Fecha Carga</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-bold">{r.employeeName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10">
                            {r.documentType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-zinc-500">
                        {format(parseISO(r.uploadDate), "dd/MM/yyyy", { locale: es })}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs italic text-zinc-500">
                        {r.notes || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setViewingDoc(r)}>
                            <Eye className="h-3 w-3" /> Ver
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 gap-1" asChild>
                            <a href={r.fileUrl} download={r.fileName}>
                                <Download className="h-3 w-3" /> Descargar
                            </a>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(r.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground italic">
              No se encontraron documentos en el expediente con los filtros actuales.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewingDoc} onOpenChange={(open) => !open && setViewingDoc(null)}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between bg-white shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileBadge className="h-5 w-5 text-primary" /> 
              EXPEDIENTE: {viewingDoc?.employeeName} - {viewingDoc?.documentType}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setViewingDoc(null)} className="rounded-full">
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <div className="flex-1 relative bg-zinc-100">
            {viewingDoc && (
              viewingDoc.fileName.toLowerCase().endsWith('.pdf') ? (
                <PdfViewer file={viewingDoc.fileUrl} />
              ) : (
                <div className="h-full w-full p-4 overflow-auto flex justify-center items-start">
                   <img src={viewingDoc.fileUrl} alt={viewingDoc.fileName} className="max-w-full h-auto shadow-2xl rounded-lg border-4 border-white" />
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
