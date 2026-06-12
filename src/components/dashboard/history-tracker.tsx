'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FolderArchive, 
  PlusCircle, 
  Loader2, 
  FileText, 
  Download, 
  Trash2, 
  Calendar,
  ShieldCheck,
  Eye,
  X,
  FileBadge
} from 'lucide-react';
import { HistoryForm } from './history-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { EmployeeHistoryRecord } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { PdfViewer } from '@/components/ui/pdf-viewer';

export function HistoryTracker() {
  const [records, setRecords] = useState<EmployeeHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<EmployeeHistoryRecord | null>(null);
  const { toast } = useToast();

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        setRecords(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este documento de tu expediente?')) return;
    
    try {
      const res = await fetch('/api/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setRecords(prev => prev.filter(r => r.id !== id));
        toast({ title: 'Documento Eliminado' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error al eliminar' });
    }
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline flex items-center gap-2">
            <FolderArchive className="h-6 w-6 text-primary" />
            Expediente Digital
          </h2>
          <p className="text-sm text-muted-foreground">Administra tus permanencias del ISSS y otros documentos oficiales.</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="gap-2 shadow-lg h-11 bg-primary text-white">
          <PlusCircle className="h-4 w-4" /> Subir Documento
        </Button>
      </div>

      <div className="grid gap-4">
        {records.length > 0 ? (
          records.map((doc) => (
            <Card key={doc.id} className="group hover:shadow-md transition-all border-l-4 border-l-primary/40 bg-card">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-xl text-primary shrink-0">
                        <FileText className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base uppercase tracking-tight">{doc.documentType}</h3>
                        <Badge variant="outline" className="text-[9px] h-4 bg-zinc-50">{doc.fileName.split('.').pop()?.toUpperCase()}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                        <Calendar className="h-3 w-3" />
                        Cargado: {format(parseISO(doc.uploadDate), "dd 'de' MMMM, yyyy", { locale: es })}
                      </div>
                      {doc.notes && <p className="text-xs text-zinc-500 italic">"{doc.notes}"</p>}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => setViewingDoc(doc)}>
                        <Eye className="h-4 w-4" /> Ver
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(doc.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-3xl flex flex-col items-center">
            <FolderArchive className="h-12 w-12 opacity-10 mb-4" />
            <h3 className="font-bold text-lg text-muted-foreground/60">Tu expediente está vacío</h3>
            <p className="text-sm text-muted-foreground/40 max-w-xs mt-1">Sube tus permanencias del ISSS o títulos para tenerlos siempre a mano.</p>
          </div>
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Subir Documento</DialogTitle>
            <DialogDescription>Añade un nuevo archivo a tu expediente digital.</DialogDescription>
          </DialogHeader>
          <HistoryForm onSuccess={() => {
            setIsFormOpen(false);
            fetchHistory();
          }} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingDoc} onOpenChange={(open) => !open && setViewingDoc(null)}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between bg-white shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileBadge className="h-5 w-5 text-primary" /> 
              {viewingDoc?.documentType} - {viewingDoc?.fileName}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setViewingDoc(null)} className="rounded-full">
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <div className="flex-1 relative bg-zinc-50">
            {viewingDoc && (
              viewingDoc.fileName.toLowerCase().endsWith('.pdf') ? (
                <PdfViewer file={viewingDoc.fileUrl} />
              ) : (
                <div className="h-full w-full p-4 overflow-auto flex justify-center items-start">
                   <img src={viewingDoc.fileUrl} alt={viewingDoc.fileName} className="max-w-full h-auto shadow-2xl rounded-lg" />
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
