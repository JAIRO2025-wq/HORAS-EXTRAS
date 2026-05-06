
'use client';

import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Maximize,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Configurar el worker de PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  file: string;
}

export function PdfViewer({ file }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  const changePage = (offset: number) => {
    setPageNumber(prevPageNumber => prevPageNumber + offset);
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const resetZoom = () => setScale(1.0);

  return (
    <div className="flex flex-col h-full bg-zinc-100 rounded-lg overflow-hidden border border-zinc-200" ref={containerRef}>
      {/* Barra de Herramientas */}
      <div className="flex items-center justify-between p-2 bg-white border-b shadow-sm z-10 sticky top-0 shrink-0">
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={previousPage} 
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-[10px] font-bold min-w-[60px] text-center">
            Pág {pageNumber} / {numPages || '--'}
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={nextPage} 
            disabled={numPages === null || pageNumber >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut} disabled={scale <= 0.5}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-[10px] font-mono font-bold w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn} disabled={scale >= 3.0}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <div className="w-[1px] h-4 bg-zinc-200 mx-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={resetZoom}>
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Area del Documento - IMPORTANTE: overflow-auto para scroll real */}
      <div className="flex-1 overflow-auto bg-zinc-200/50 p-4 flex justify-center items-start scrollbar-thin scrollbar-thumb-zinc-300">
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex flex-col items-center justify-center p-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Abriendo Documento...</span>
            </div>
          }
          error={
            <div className="p-10 text-center bg-white rounded-xl border-2 border-dashed border-red-200 text-red-600">
              <AlertTriangle className="mx-auto h-10 w-10 mb-2 opacity-50" />
              <p className="font-bold">Error al cargar PDF</p>
              <p className="text-[10px] opacity-70">El archivo podría estar dañado o no existir.</p>
            </div>
          }
        >
          <div className="shadow-2xl bg-white">
            <Page 
              pageNumber={pageNumber} 
              scale={scale} 
              width={containerWidth ? Math.min(containerWidth - 40, 800) : undefined}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </div>
        </Document>
      </div>
    </div>
  );
}
