
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Eye, Loader2, Calendar, AlertCircle, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PdfViewer } from '@/components/ui/pdf-viewer';

type Stub = {
  year: number;
  month: string;
  quincena: number;
  fileName: string;
  viewUrl: string;
};

export function PayStubsViewer() {
  const [stubs, setStubs] = useState<Stub[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStub, setSelectedStub] = useState<Stub | null>(null);

  useEffect(() => {
    const fetchStubs = async () => {
      const storedUser = localStorage.getItem('overtimeUser');
      if (!storedUser) return;
      const { name } = JSON.parse(storedUser);

      try {
        const res = await fetch(`/api/pay-stubs/my-list?user=${encodeURIComponent(name)}`);
        if (res.ok) {
          const data = await res.json();
          setStubs(data);
        }
      } catch (error) {
        console.error("Error fetching my stubs", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStubs();
  }, []);

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/10 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
                <CardTitle>Mis Recibos de Pago</CardTitle>
                <CardDescription>Consulta y descarga tus últimos 6 comprobantes de pago.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {stubs.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stubs.map((stub, idx) => (
                <Card key={idx} className="group hover:border-primary/40 transition-colors border-dashed bg-muted/5">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">{stub.year}</span>
                            <span className="text-lg font-bold text-foreground">{stub.month}</span>
                        </div>
                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10 border-none">
                            Q{stub.quincena}
                        </Badge>
                    </div>
                    
                    <div className="flex gap-2">
                        <Button 
                            className="flex-1 gap-2" 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedStub(stub)}
                        >
                            <Eye className="h-3.5 w-3.5" /> Ver
                        </Button>
                        <Button 
                            className="flex-1 gap-2 bg-primary/5 text-primary hover:bg-primary/10 border-none" 
                            variant="ghost" 
                            size="sm"
                            asChild
                        >
                            <a href={stub.viewUrl} download={`Recibo_${stub.month}_Q${stub.quincena}.pdf`}>
                                <Download className="h-3.5 w-3.5" /> PDF
                            </a>
                        </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/30">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="font-bold text-lg text-muted-foreground">No hay recibos disponibles</h3>
                <p className="text-sm text-muted-foreground/60 max-w-[250px] mx-auto mt-1">
                    Tus recibos aparecerán aquí una vez que la administración los procese.
                </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedStub} onOpenChange={(open) => !open && setSelectedStub(null)}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden bg-white sm:rounded-2xl border-none shadow-2xl">
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between shrink-0 bg-white">
            <DialogTitle className="flex items-center gap-2">
                <div className="bg-primary/10 p-1.5 rounded-md">
                    <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex flex-col text-left">
                    <span className="text-xs font-black uppercase text-zinc-400 leading-none">Visor de Recibo</span>
                    <span className="text-sm font-bold text-zinc-900">{selectedStub?.month} - Quincena {selectedStub?.quincena}</span>
                </div>
            </DialogTitle>
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => setSelectedStub(null)}>
                <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <div className="flex-1 relative bg-zinc-50 overflow-hidden">
            {selectedStub && (
                <PdfViewer file={selectedStub.viewUrl} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
