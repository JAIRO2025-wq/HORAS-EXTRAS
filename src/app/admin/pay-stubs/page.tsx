
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
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
import { 
  FileBadge, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  FileText,
  Save,
  Eye,
  Trash2,
  Search,
  FileSearch,
  UserPlus,
  ChevronDown,
  Link2,
  Check,
  Clock,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Employee } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import * as pdfjs from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { months } from '@/lib/data';
import { PdfViewer } from '@/components/ui/pdf-viewer';

// Configurar worker de pdf.js
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type IdentifiedStub = {
  id: string;
  fileName: string;
  pageNumber: number;
  extractedName: string;
  matchedEmployee: { id: number; name: string } | null;
  fileDataUri: string; 
  status: 'success' | 'failed' | 'saved';
};

const years = [2025, 2026, 2027];
const ITEMS_PER_PAGE = 10;

export default function PayStubsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [identifiedStubs, setIdentifiedStubs] = useState<IdentifiedStub[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedStubId, setSelectedStubId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);

  // Período
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(months[new Date().getMonth()]);
  const [selectedQuincena, setSelectedQuincena] = useState('1');

  // Estado para el flujo de vinculación manual
  const [pendingAssignment, setPendingAssignment] = useState<{
    employee: Employee;
    stub: IdentifiedStub;
  } | null>(null);

  const { toast } = useToast();

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      const data = await response.json();
      setEmployees(data.filter((e: Employee) => e.status === 'active'));
    } catch (error) {
      console.error(error);
    }
  };

  const fetchExistingStubs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/pay-stubs/list?year=${selectedYear}&month=${selectedMonth}&quincena=${selectedQuincena}`
      );
      if (!response.ok) throw new Error('Failed to list stubs');
      const existingFiles: { fileName: string; employeeName: string }[] = await response.json();
      
      const cleanForMatch = (name: string) => name.replace(/[^a-z0-9]/gi, '_').toUpperCase();

      const stubsFromServer: IdentifiedStub[] = existingFiles.map(f => {
        const matched = employees.find(e => 
          cleanForMatch(e.name) === cleanForMatch(f.employeeName)
        );

        return {
          id: `server-${f.fileName}`,
          fileName: f.fileName,
          pageNumber: 1,
          extractedName: f.employeeName,
          matchedEmployee: matched ? { id: matched.id, name: matched.name } : null,
          fileDataUri: `/api/admin/pay-stubs/view?year=${selectedYear}&month=${selectedMonth}&quincena=${selectedQuincena}&employee=${encodeURIComponent(f.employeeName)}`,
          status: 'saved'
        };
      });

      setIdentifiedStubs(stubsFromServer);
      setCurrentPage(1); // Reset paginación al cambiar filtros
    } catch (error) {
      console.error(error);
      setIdentifiedStubs([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonth, selectedQuincena, employees]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (employees.length > 0) {
      fetchExistingStubs();
    }
  }, [selectedYear, selectedMonth, selectedQuincena, employees.length, fetchExistingStubs]);

  // Reset de página al buscar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const findEmployeeInText = (text: string, employeeList: Employee[]) => {
    const normalizeText = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    const normalizedPDF = normalizeText(text);
    
    for (const emp of employeeList) {
      const systemNameParts = normalizeText(emp.name).split(/\s+/).filter(p => p.length > 1);
      if (systemNameParts.length === 0) continue;

      const firstName = systemNameParts[0];
      if (!normalizedPDF.includes(firstName)) continue;

      if (systemNameParts.length >= 2) {
        const secondName = systemNameParts[1];
        if (!normalizedPDF.includes(secondName)) continue;
      }

      const mainSurname = systemNameParts[systemNameParts.length - 1];
      if (!normalizedPDF.includes(mainSurname)) continue;

      return emp;
    }
    return null;
  };

  const extractNameFromFields = (text: string): string => {
    const upperBlocks = text.match(/[A-Z]{3,}(\s[A-Z]{3,})+/g);
    if (upperBlocks && upperBlocks.length > 0) {
        for (const block of upperBlocks) {
            const cleanBlock = block.toUpperCase().trim();
            const isCompanyHeader = ["FLYNET", "BUSSINES", "SYSTEM", "BUSINESS"].some(kw => cleanBlock.includes(kw));
            if (!isCompanyHeader && cleanBlock.length > 5) {
                return cleanBlock;
            }
        }
    }
    return "No identificado";
  };

  const splitAndProcessPDF = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pdfjsDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    
    const newStubs: IdentifiedStub[] = [];
    const totalPages = pdfDoc.getPageCount();

    for (let i = 0; i < totalPages; i++) {
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);
      const pdfBytes = await singlePageDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const pageDataUri = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const page = await pdfjsDoc.getPage(i + 1);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: any) => item.str).join(' ');
      
      const rawExtractedName = extractNameFromFields(text);
      const matched = findEmployeeInText(text, employees);
      
      newStubs.push({
          id: crypto.randomUUID(),
          fileName: file.name,
          pageNumber: i + 1,
          extractedName: matched ? matched.name : rawExtractedName,
          matchedEmployee: matched ? { id: matched.id, name: matched.name } : null,
          fileDataUri: pageDataUri,
          status: matched ? 'success' : 'failed'
      });

      setProgress(((i + 1) / totalPages) * 100);
    }

    return newStubs;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setProgress(0);

    let allNewStubs: IdentifiedStub[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'application/pdf') continue;

      try {
        const stubs = await splitAndProcessPDF(file);
        allNewStubs = [...allNewStubs, ...stubs];
      } catch (error) {
        console.error(error);
      }
    }

    setIdentifiedStubs(prev => {
        const newMatchedIds = allNewStubs.filter(s => s.matchedEmployee).map(s => s.matchedEmployee!.id);
        const filteredPrev = prev.filter(s => !s.matchedEmployee || !newMatchedIds.includes(s.matchedEmployee.id));
        return [...filteredPrev, ...allNewStubs];
    });
    setIsProcessing(false);
    setCurrentPage(1);
  };

  const handleManualAssignFile = async (e: React.ChangeEvent<HTMLInputElement>, employee: Employee) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const dataUri = event.target?.result as string;
        const newStub: IdentifiedStub = {
            id: crypto.randomUUID(),
            fileName: file.name,
            pageNumber: 1,
            extractedName: employee.name,
            matchedEmployee: { id: employee.id, name: employee.name },
            fileDataUri: dataUri,
            status: 'success'
        };
        setIdentifiedStubs(prev => {
            const filtered = prev.filter(s => s.matchedEmployee?.id !== employee.id);
            return [...filtered, newStub];
        });
        toast({ title: "Asignado", description: `Recibo vinculado a ${employee.name}` });
    };
    reader.readAsDataURL(file);
  };

  const startLinkingFlow = (leftover: IdentifiedStub, employee: Employee) => {
    setSelectedStubId(leftover.id);
    setPendingAssignment({ employee, stub: leftover });
    toast({ title: "Modo de Selección", description: "Revisa el PDF a la derecha y confirma la vinculación." });
  };

  const confirmAssignment = () => {
    if (!pendingAssignment) return;
    
    const { employee, stub } = pendingAssignment;

    setIdentifiedStubs(prev => {
        const filtered = prev.filter(s => s.id !== stub.id);
        const withoutOld = filtered.filter(s => s.matchedEmployee?.id !== employee.id);
        const updatedStub: IdentifiedStub = {
            ...stub,
            matchedEmployee: { id: employee.id, name: employee.name },
            status: 'success'
        };
        return [...withoutOld, updatedStub];
    });

    toast({ title: "Vinculación Exitosa", description: `${employee.name} vinculado con la página seleccionada.` });
    setPendingAssignment(null);
  };

  const handleDeleteStub = async (stub: IdentifiedStub) => {
    if (stub.status === 'saved') {
        try {
            const res = await fetch('/api/admin/pay-stubs/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    year: selectedYear,
                    month: selectedMonth,
                    quincena: selectedQuincena,
                    employeeName: stub.extractedName
                })
            });
            if (res.ok) {
                toast({ title: "Eliminado", description: "Archivo eliminado del servidor." });
            }
        } catch (e) {
            console.error(e);
        }
    }

    setIdentifiedStubs(prev => prev.filter(s => s.id !== stub.id));
    if (selectedStubId === stub.id) setSelectedStubId(null);
  };

  const handleSaveAll = async () => {
    const linkedStubs = identifiedStubs.filter(s => s.matchedEmployee && s.status !== 'saved');
    if (linkedStubs.length === 0) {
        toast({ variant: 'destructive', title: "Nada que guardar", description: "No hay recibos vinculados nuevos." });
        return;
    }

    setIsSaving(true);
    let count = 0;

    for (const stub of linkedStubs) {
        try {
            const response = await fetch('/api/admin/pay-stubs/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employeeName: stub.matchedEmployee!.name,
                    year: selectedYear,
                    month: selectedMonth,
                    quincena: selectedQuincena,
                    fileDataUri: stub.fileDataUri
                })
            });

            if (response.ok) {
                setIdentifiedStubs(prev => prev.map(s => s.id === stub.id ? { ...s, status: 'saved' } : s));
                count++;
            }
        } catch (error) {
            console.error("Error saving stub", error);
        }
    }

    setIsSaving(false);
    toast({
        title: "Guardado Finalizado",
        description: `Se han guardado ${count} recibos exitosamente en el servidor.`
    });
  };

  const leftovers = identifiedStubs.filter(s => !s.matchedEmployee);

  // COMBINACIÓN DE DATOS PARA LA TABLA (RECONCILIACIÓN + SOBRANTES)
  const allTableRows = useMemo(() => {
    const reconciliationRows = employees
      .filter(emp => 
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.id.toString().includes(searchTerm)
      )
      .map(emp => {
        const stub = identifiedStubs.find(s => s.matchedEmployee?.id === emp.id);
        return { type: 'employee' as const, employee: emp, stub: stub || null };
      });

    const leftoverRows = leftovers.map(stub => ({ 
      type: 'leftover' as const, 
      employee: null, 
      stub 
    }));

    // Si hay búsqueda, los leftovers solo se muestran si no hay nada más o si coinciden con algo (opcional)
    // Para simplificar, los ponemos al final.
    return [...reconciliationRows, ...leftoverRows];
  }, [employees, identifiedStubs, leftovers, searchTerm]);

  // PAGINACIÓN DE LOS DATOS COMBINADOS
  const totalPages = Math.ceil(allTableRows.length / ITEMS_PER_PAGE);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return allTableRows.slice(start, start + ITEMS_PER_PAGE);
  }, [allTableRows, currentPage]);

  const selectedStub = identifiedStubs.find(s => s.id === selectedStubId);

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-col md:flex-row items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
            <FileBadge className="h-6 w-6 text-primary" />
            Gestor de Recibos
          </h1>
          <p className="text-muted-foreground text-sm">Organiza y guarda los recibos de pago del personal.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
            <Card className="flex items-center p-1 bg-muted/20 gap-2 border-primary/10">
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[90px] h-8 text-xs border-none bg-transparent">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                    </SelectContent>
                </Select>
                <div className="w-[1px] h-4 bg-muted-foreground/20" />
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[110px] h-8 text-xs border-none bg-transparent">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
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

            <Button size="icon" variant="ghost" className="h-10 w-10" onClick={fetchExistingStubs} title="Recargar del servidor">
                <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </Button>

            <Button className="relative h-10 gap-2" variant="outline" disabled={isLoading}>
                <Upload className="h-4 w-4" />
                Cargar Planilla
                <input type="file" multiple accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} />
            </Button>
            
            <Button 
                className="h-10 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleSaveAll}
                disabled={isSaving || identifiedStubs.filter(s => s.matchedEmployee && s.status !== 'saved').length === 0}
            >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar Todo
            </Button>
        </div>
      </div>

      {isProcessing && (
        <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2 text-primary">
                    <span className="text-sm font-medium flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Procesando planilla...
                    </span>
                    <span className="text-sm font-bold">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
            </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden min-h-[650px]">
        <Card className="flex flex-col overflow-hidden border-2">
          <CardHeader className="pb-3 border-b bg-muted/10">
            <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-lg flex items-center gap-2">
                    <FileSearch className="h-5 w-5 text-primary" /> Cotejo de Planilla
                </CardTitle>
                <div className="relative flex-1 max-w-[200px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar empleado..." className="pl-8 h-9 text-xs" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0 flex flex-col">
            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p>Consultando servidor...</p>
                </div>
            ) : (
                <>
                <div className="flex-1 overflow-auto">
                    <Table>
                    <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                        <TableRow>
                        <TableHead className="w-[60px]">ID</TableHead>
                        <TableHead>Empleado / Archivo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedRows.map((row, idx) => {
                            if (row.type === 'employee' && row.employee) {
                                const { employee, stub } = row;
                                return (
                                    <TableRow key={employee.id} className={selectedStubId === stub?.id ? "bg-primary/10" : ""}>
                                        <TableCell className="font-mono text-xs text-muted-foreground">{employee.id}</TableCell>
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span className="text-sm">{employee.name}</span>
                                                <span className="text-[9px] text-muted-foreground uppercase font-bold">{employee.branch}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {stub?.status === 'saved' ? (
                                                <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50">
                                                    <CheckCircle2 className="h-3 w-3" /> Guardado
                                                </Badge>
                                            ) : stub ? (
                                                <Badge variant="secondary" className="gap-1 bg-green-50 text-green-700 border-green-100 hover:bg-green-50">
                                                    <CheckCircle2 className="h-3 w-3" /> Vinculado
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="gap-1 opacity-40">
                                                    <XCircle className="h-3 w-3" /> Pendiente
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                {stub ? (
                                                    <>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedStubId(stub.id)}><Eye className="h-4 w-4" /></Button>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteStub(stub)}><Trash2 className="h-4 w-4" /></Button>
                                                    </>
                                                ) : (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button size="sm" variant="outline" className="h-8 gap-1">
                                                                <UserPlus className="h-3.5 w-3.5" /> Asignar <ChevronDown className="h-3 w-3 opacity-50" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-[300px]">
                                                            <DropdownMenuLabel className="text-[10px] uppercase">Opciones de Asignación</DropdownMenuLabel>
                                                            <DropdownMenuItem className="relative cursor-pointer">
                                                                <Upload className="mr-2 h-4 w-4" /> Subir archivo PDF...
                                                                <input type="file" accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleManualAssignFile(e, employee)} />
                                                            </DropdownMenuItem>
                                                            
                                                            {leftovers.length > 0 && (
                                                                <>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuLabel className="text-[10px] uppercase text-primary">Sugerencias (Por Página)</DropdownMenuLabel>
                                                                    {leftovers.map(leftover => (
                                                                        <DropdownMenuItem 
                                                                            key={leftover.id} 
                                                                            onClick={() => startLinkingFlow(leftover, employee)}
                                                                            className="text-xs py-2"
                                                                        >
                                                                            <Link2 className="mr-2 h-3.5 w-3.5 shrink-0" /> 
                                                                            <div className="flex flex-col truncate">
                                                                                <span className="font-bold truncate">Página {leftover.pageNumber}</span>
                                                                                <span className="text-[8px] opacity-60">Nombre: {leftover.extractedName}</span>
                                                                            </div>
                                                                        </DropdownMenuItem>
                                                                    ))}
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            } else if (row.type === 'leftover' && row.stub) {
                                const { stub } = row;
                                return (
                                    <TableRow key={stub.id} className={selectedStubId === stub.id ? "bg-primary/10" : "bg-destructive/5"}>
                                        <TableCell colSpan={2}>
                                            <div className="flex flex-col pl-2">
                                                <span className="text-red-600 font-black text-sm uppercase">PÁGINA {stub.pageNumber}</span>
                                                <span className="text-[9px] text-muted-foreground truncate max-w-[200px]">Extraído: {stub.extractedName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell><Badge variant="destructive" className="gap-1 text-[10px]">Sin Dueño</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button size="icon" variant="ghost" onClick={() => {
                                                    setSelectedStubId(stub.id);
                                                    setPendingAssignment(null);
                                                }}><Eye className="h-4 w-4" /></Button>
                                                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeleteStub(stub)}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            }
                            return null;
                        })}
                    </TableBody>
                    </Table>
                </div>

                {/* PAGINACIÓN */}
                {allTableRows.length > ITEMS_PER_PAGE && (
                    <div className="p-4 border-t flex items-center justify-between bg-muted/5">
                        <div className="text-xs text-muted-foreground">
                            Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, allTableRows.length)} de {allTableRows.length}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs font-bold w-12 text-center">
                                {currentPage} / {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
                </>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col overflow-hidden border-2 shadow-sm">
          <CardHeader className="bg-muted/30 pb-3 border-b flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Vista Previa</CardTitle>
                <div className="flex items-center gap-2">
                    {pendingAssignment && selectedStubId === pendingAssignment.stub.id && (
                        <Button 
                            size="sm" 
                            className="gap-2 bg-green-600 text-white hover:bg-green-700" 
                            onClick={confirmAssignment}
                        >
                            <Check className="h-4 w-4" /> Vincular a {pendingAssignment.employee.name.split(' ')[0]}
                        </Button>
                    )}
                </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 bg-muted/5 relative min-h-[500px]">
            {selectedStub ? (
                <div className="h-full w-full flex flex-col">
                    <div className="p-2 bg-primary/10 border-b text-[10px] flex justify-between px-4 font-bold text-primary">
                        <span>ORIGEN: {selectedStub.status === 'saved' ? 'Servidor' : selectedStub.fileName} {selectedStub.status !== 'saved' && `(Pág. ${selectedStub.pageNumber})`}</span>
                        <span>IDENTIFICADO: {selectedStub.extractedName}</span>
                    </div>
                    <div className="flex-1">
                        <PdfViewer file={selectedStub.fileDataUri} />
                    </div>
                </div>
            ) : (
                <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
                    <div className="bg-muted/50 p-8 rounded-full mb-6 border-2 border-dashed border-muted-foreground/20">
                        <FileSearch className="h-16 w-16 opacity-10" />
                    </div>
                    <h3 className="font-bold text-xl text-foreground/70">Selecciona un registro</h3>
                    <p className="text-sm max-w-[280px] mt-2">Usa el icono del ojo o selecciona una sugerencia para ver el contenido del PDF.</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
