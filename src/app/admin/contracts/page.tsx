'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { ContractRecord, Employee, Dependiente, CompanyProfile, Branch } from '@/lib/types';
import { numeroALetras, fechaEnLetras } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  FileText, FileCheck, Shield, Receipt, Upload, Download,
  Plus, Search, Loader2, Trash2, Eye, CheckCircle2, Clock,
  AlertCircle, XCircle, FileSignature, Calendar, DollarSign,
  Building, User, Briefcase, Users, IdCard, MapPin, BookOpen,
  ChevronDown, ChevronUp, Edit3,
} from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  pendiente: { label: 'Pendiente', variant: 'outline', icon: Clock },
  generado: { label: 'Generado', variant: 'secondary', icon: FileText },
  firmado: { label: 'Firmado', variant: 'default', icon: CheckCircle2 },
  activo: { label: 'Activo', variant: 'default', icon: CheckCircle2 },
  vencido: { label: 'Vencido', variant: 'destructive', icon: XCircle },
};

const CONTRACT_TYPES = [
  { value: 'indefinido', label: 'Indefinido' },
  { value: 'temporal', label: 'Temporal' },
  { value: 'obra', label: 'Por Obra' },
  { value: 'servicios', label: 'Servicios Profesionales' },
];

const DURACION_TIPOS = [
  'Indefinido',
  'Por un período de prueba de 30 días',
  'Por 3 meses',
  'Por 6 meses',
  'Por 1 año',
  'Por obra o servicio determinado',
];

const emptyDependiente = (): Dependiente => ({ nombre: '', apellido: '', edad: '', parentesco: '', direccion: '' });

const defaultForm = {
  // Empresa
  razonSocialEmpresa: '',
  abreviaturaEmpresa: '',
  // Empleador
  nombreEmpleador: '',
  duiEmpleador: '',
  nitEmpleador: '',
  edadEmpleador: '',
  sexoEmpleador: '',
  nacionalidadEmpleador: '',
  estadoFamiliarEmpleador: '',
  profesionEmpleador: '',
  domicilioEmpleador: '',
  lugarExpedicionDuiEmpleador: '',
  fechaExpedicionDuiEmpleador: '',
  // Empleado
  nombreEmpleado: '',
  duiEmpleado: '',
  nitEmpleado: '',
  edadEmpleado: '',
  sexoEmpleado: '',
  nacionalidadEmpleado: '',
  estadoFamiliarEmpleado: '',
  profesionEmpleado: '',
  domicilioEmpleado: '',
  residenciaEmpleado: '',
  lugarExpedicionDuiEmpleado: '',
  fechaExpedicionDuiEmpleado: '',
  // Contrato
  cargoPuesto: '',
  representanteLegalEmpresa: '',
  tipoDuracionContrato: '',
  periodoContrato: '',
  fechaInicioServicio: '',
  lugarPrestacionServicios: '',
  direccionPrestacionServicios: '',
  horasSemanaLaboral: '',
  horarioDeTrabajo: '',
  salarioEnNumeros: '',
  salarioEnLetras: '',
  formaYPeriodoPago: '',
  nombreEmpresaPago: '',
  direccionLugarPago: '',
  obligacionesYFuncionesCargo: '',
  listaHerramientasYMateriales: '',
  incentivosAdicionales: '',
  // Firma
  distritoFirma: '',
  fechaFirmaEnLetras: '',
  // Confidencialidad
  direccionInstalacionesEmpresa: '',
  ciudadJurisdiccionTribunales: '',
  // Constancia de Salario
  fechaIngreso: '',
  sueldoBase: '',
  deduccionIsss: '',
  deduccionAfp: '',
  deduccionIsr: '',
  deduccionOtros: '',
  totalDeducciones: '',
  otrosIngresos: '',
  totalIngresos: '',
  liquidoAPagar: '',
  nombreRepresentanteRrhh: '',
  cargoRepresentanteRrhh: '',
  destinatarioInstitucionOPersona: '',
  ciudadEmision: '',
  fechaEmisionEnLetras: '',
  // Metadatos
  employeeId: 0,
  employeeName: '',
  branch: '',
  contractType: 'indefinido',
  startDate: '',
  endDate: '',
  salary: 0,
  notes: '',
};

// Componentes estables fuera del componente principal (evita pérdida de foco)
const FormInput = ({ label, value, onChange, placeholder, required, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; type?: string;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label} {required && <span className="text-destructive">*</span>}</Label>
    <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 text-sm" />
  </div>
);

const FormTextarea = ({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="text-sm" />
  </div>
);

const FormSelect = ({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-sm">
        <SelectValue placeholder={placeholder || 'Seleccionar...'} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

const FormSectionHeader = ({ icon: Icon, title, expanded, onToggle }: {
  icon: any; title: string; expanded: boolean; onToggle: () => void;
}) => (
  <button type="button"
    className="flex items-center gap-3 w-full py-3 px-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
    onClick={onToggle}
  >
    <Icon className="h-5 w-5 text-primary" />
    <span className="font-bold text-sm">{title}</span>
    <div className="flex-1" />
    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
  </button>
);

const PreviewRow = ({ label, value, span }: { label: string; value?: string; span?: boolean }) => (
  <div className={span ? 'col-span-2' : ''}>
    <span className="text-muted-foreground">{label}:</span>{' '}
    <span className={value ? 'font-medium' : 'text-muted-foreground/50 italic'}>
      {value || '—'}
    </span>
  </div>
);

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [expandedSections, setExpandedSections] = useState<string[]>(['empresa']);

  // Dialogs
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<ContractRecord | null>(null);
  const [showGenerate, setShowGenerate] = useState<{ contract: ContractRecord; type: string } | null>(null);
  const [showUpload, setShowUpload] = useState<{ contract: ContractRecord; type: string; label: string } | null>(null);
  const [showEdit, setShowEdit] = useState<ContractRecord | null>(null);
  const [showCompanySelect, setShowCompanySelect] = useState(false);
  const [companyProfiles, setCompanyProfiles] = useState<CompanyProfile[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const { toast } = useToast();

  const [form, setForm] = useState({ ...defaultForm });
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [dependientes, setDependientes] = useState<Dependiente[]>([emptyDependiente(), emptyDependiente()]);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTab, setCurrentTab] = useState('empresa');

  const fetchContracts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/contracts');
      if (res.ok) setContracts(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees');
      if (res.ok) setEmployees(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await fetch('/api/branches');
      if (res.ok) setBranches(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    Promise.all([fetchContracts(), fetchEmployees(), fetchBranches()]).finally(() => setIsLoading(false));
  }, [fetchContracts, fetchEmployees, fetchBranches]);

  // Auto-llenados del formulario
  useEffect(() => {
    // Salario en números → Salario en letras
    if (form.salarioEnNumeros) {
      const num = parseFloat(form.salarioEnNumeros.replace(/[^0-9.]/g, ''));
      if (!isNaN(num) && num > 0) {
        const letras = numeroALetras(num);
        if (form.salarioEnLetras !== letras) updateForm('salarioEnLetras', letras);
        if (!form.sueldoBase || form.sueldoBase !== form.salarioEnNumeros) updateForm('sueldoBase', form.salarioEnNumeros);
      }
    }
  }, [form.salarioEnNumeros]);

  useEffect(() => {
    // Fecha Inicio Servicio → Fecha de Ingreso (constancia)
    if (form.fechaInicioServicio && form.fechaIngreso !== form.fechaInicioServicio) {
      updateForm('fechaIngreso', form.fechaInicioServicio);
    }
  }, [form.fechaInicioServicio]);

  useEffect(() => {
    // Ciudad Jurisdicción Tribunales → Ciudad de Emisión
    if (form.ciudadJurisdiccionTribunales && form.ciudadEmision !== form.ciudadJurisdiccionTribunales) {
      updateForm('ciudadEmision', form.ciudadJurisdiccionTribunales);
    }
  }, [form.ciudadJurisdiccionTribunales]);

  const resetForm = () => {
    setForm({ ...defaultForm });
    setDependientes([emptyDependiente(), emptyDependiente()]);
    setSelectedEmployee(null);
    setCurrentTab('empresa');
  };

  // Cargar CompanyDefaults al abrir el diálogo de crear
  const openCreate = async () => {
    resetForm();
    let formWithDefaults = { ...defaultForm };
    const fechaHoy = fechaEnLetras(new Date());

    // Cargar perfiles de empresa
    try {
      const res = await fetch('/api/admin/datos-c');
      if (res.ok) {
        const profiles: CompanyProfile[] = await res.json();
        setCompanyProfiles(profiles);

        if (profiles.length === 0) {
          // Sin empresas configuradas: abrir form vacío con fechas automáticas
          setForm({ ...formWithDefaults, fechaFirmaEnLetras: fechaHoy, fechaEmisionEnLetras: fechaHoy });
          setShowCreate(true);
          return;
        }

        if (profiles.length === 1) {
          // Una sola empresa: cargar defaults + fechas automáticas
          formWithDefaults = applyDefaults(profiles[0], formWithDefaults);
          setForm({ ...formWithDefaults, fechaFirmaEnLetras: fechaHoy, fechaEmisionEnLetras: fechaHoy });
          setShowCreate(true);
          return;
        }

        // Múltiples empresas: mostrar selector
        setShowCompanySelect(true);
      }
    } catch (e) {
      setForm({ ...formWithDefaults, fechaFirmaEnLetras: fechaHoy, fechaEmisionEnLetras: fechaHoy });
      setShowCreate(true);
    }
  };

  // Aplicar defaults de una empresa al formulario
  const applyDefaults = (profile: CompanyProfile, baseForm = defaultForm) => ({
    ...baseForm,
    razonSocialEmpresa: profile.razonSocialEmpresa || '',
    abreviaturaEmpresa: profile.abreviaturaEmpresa || '',
    representanteLegalEmpresa: profile.representanteLegalEmpresa || '',
    nombreEmpleador: profile.nombreEmpleador || '',
    duiEmpleador: profile.duiEmpleador || '',
    nitEmpleador: profile.nitEmpleador || '',
    edadEmpleador: profile.edadEmpleador || '',
    sexoEmpleador: profile.sexoEmpleador || '',
    nacionalidadEmpleador: profile.nacionalidadEmpleador || '',
    estadoFamiliarEmpleador: profile.estadoFamiliarEmpleador || '',
    profesionEmpleador: profile.profesionEmpleador || '',
    domicilioEmpleador: profile.domicilioEmpleador || '',
    lugarExpedicionDuiEmpleador: profile.lugarExpedicionDuiEmpleador || '',
    fechaExpedicionDuiEmpleador: profile.fechaExpedicionDuiEmpleador || '',
    distritoFirma: profile.distritoFirma || '',
    fechaFirmaEnLetras: profile.fechaFirmaEnLetras || '',
    direccionInstalacionesEmpresa: profile.direccionInstalacionesEmpresa || '',
    ciudadJurisdiccionTribunales: profile.ciudadJurisdiccionTribunales || '',
    nombreRepresentanteRrhh: profile.nombreRepresentanteRrhh || '',
    cargoRepresentanteRrhh: profile.cargoRepresentanteRrhh || '',
  });

  // Usuario seleccionó empresa del diálogo
  const handleCompanySelected = () => {
    const profile = companyProfiles.find((p) => p.id === selectedCompanyId);
    if (!profile) return;
    const formWithDefaults = applyDefaults(profile);
    const fechaHoy = fechaEnLetras(new Date());
    setForm({ ...formWithDefaults, fechaFirmaEnLetras: fechaHoy, fechaEmisionEnLetras: fechaHoy });
    setShowCompanySelect(false);
    setShowCreate(true);
  };

  const updateForm = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateDependiente = (index: number, field: keyof Dependiente, value: string) => {
    setDependientes((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleEmployeeSelect = (empId: string) => {
    const emp = employees.find((e) => e.id === Number(empId));
    if (emp) {
      setSelectedEmployee(emp);
      updateForm('employeeId', emp.id);
      updateForm('employeeName', emp.name);
      updateForm('nombreEmpleado', emp.name);
      updateForm('branch', emp.branch);
      updateForm('cargoPuesto', emp.position || '');
      updateForm('salary', emp.salary || 0);
      updateForm('salarioEnNumeros', emp.salary ? `$${Number(emp.salary).toFixed(2)}` : '');
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  // Crear contrato
  const handleCreate = async () => {
    if (!form.nombreEmpleado || !form.cargoPuesto) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, dependientes }),
      });
      if (res.ok) {
        await fetchContracts();
        setShowCreate(false);
        resetForm();
      }
    } catch (e) { console.error(e); }
    finally { setIsSaving(false); }
  };

  // Actualizar contrato
  const handleUpdate = async () => {
    if (!showEdit) return;
    setIsSaving(true);
    try {
      await fetch('/api/admin/contracts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: showEdit.id, ...form, dependientes }),
      });
      await fetchContracts();
      setShowEdit(null);
      resetForm();
    } catch (e) { console.error(e); }
    finally { setIsSaving(false); }
  };

  // Generar documento
  const handleGenerate = async () => {
    if (!showGenerate) return;
    const { contract, type } = showGenerate;

    try {
      const res = await fetch('/api/admin/contracts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateName: type, contractData: contract }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al generar el documento');
      }

      const result = await res.json();
      const updateField =
        type === 'contrato' ? 'contractGeneratedUrl'
        : type === 'confidencialidad' ? 'confidentialityGeneratedUrl'
        : 'salaryCertificateUrl';

      await fetch('/api/admin/contracts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: contract.id, [updateField]: result.url, status: contract.status === 'pendiente' ? 'generado' : contract.status }),
      });

      await fetchContracts();
      window.open(result.url, '_blank');
      setShowGenerate(null);
      toast({ title: 'Documento generado', description: 'El documento se generó correctamente.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error al generar', description: (e as Error).message });
    }
  };

  // Subir firmado
  const handleUpload = async (file: File) => {
    if (!showUpload) return;
    const { contract, type } = showUpload;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    try {
      const res = await fetch('/api/admin/contracts/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const result = await res.json();
        const updateField =
          type === 'contract_signed' ? 'contractSignedUrl'
          : type === 'confidentiality_signed' ? 'confidentialitySignedUrl'
          : 'salaryCertificateUrl';

        await fetch('/api/admin/contracts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: contract.id, [updateField]: result.url }),
        });
        await fetchContracts();
        setShowUpload(null);
      }
    } catch (e) { console.error(e); }
  };

  const handleStatusChange = async (contract: ContractRecord, newStatus: string) => {
    await fetch('/api/admin/contracts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contract.id, status: newStatus }),
    });
    await fetchContracts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este contrato y sus archivos asociados?')) return;
    await fetch(`/api/admin/contracts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await fetchContracts();
    setShowDetail(null);
  };

  const openEdit = (contract: ContractRecord) => {
    setForm({
      razonSocialEmpresa: contract.razonSocialEmpresa,
      abreviaturaEmpresa: contract.abreviaturaEmpresa,
      nombreEmpleador: contract.nombreEmpleador,
      duiEmpleador: contract.duiEmpleador,
      nitEmpleador: contract.nitEmpleador,
      edadEmpleador: contract.edadEmpleador,
      sexoEmpleador: contract.sexoEmpleador,
      nacionalidadEmpleador: contract.nacionalidadEmpleador,
      estadoFamiliarEmpleador: contract.estadoFamiliarEmpleador,
      profesionEmpleador: contract.profesionEmpleador,
      domicilioEmpleador: contract.domicilioEmpleador,
      lugarExpedicionDuiEmpleador: contract.lugarExpedicionDuiEmpleador,
      fechaExpedicionDuiEmpleador: contract.fechaExpedicionDuiEmpleador,
      nombreEmpleado: contract.nombreEmpleado,
      duiEmpleado: contract.duiEmpleado,
      nitEmpleado: contract.nitEmpleado,
      edadEmpleado: contract.edadEmpleado,
      sexoEmpleado: contract.sexoEmpleado,
      nacionalidadEmpleado: contract.nacionalidadEmpleado,
      estadoFamiliarEmpleado: contract.estadoFamiliarEmpleado,
      profesionEmpleado: contract.profesionEmpleado,
      domicilioEmpleado: contract.domicilioEmpleado,
      residenciaEmpleado: contract.residenciaEmpleado,
      lugarExpedicionDuiEmpleado: contract.lugarExpedicionDuiEmpleado,
      fechaExpedicionDuiEmpleado: contract.fechaExpedicionDuiEmpleado,
      cargoPuesto: contract.cargoPuesto,
      representanteLegalEmpresa: contract.representanteLegalEmpresa,
      tipoDuracionContrato: contract.tipoDuracionContrato,
      periodoContrato: contract.periodoContrato,
      fechaInicioServicio: contract.fechaInicioServicio,
      lugarPrestacionServicios: contract.lugarPrestacionServicios,
      direccionPrestacionServicios: contract.direccionPrestacionServicios,
      horasSemanaLaboral: contract.horasSemanaLaboral,
      horarioDeTrabajo: contract.horarioDeTrabajo,
      salarioEnNumeros: contract.salarioEnNumeros,
      salarioEnLetras: contract.salarioEnLetras,
      formaYPeriodoPago: contract.formaYPeriodoPago,
      nombreEmpresaPago: contract.nombreEmpresaPago,
      direccionLugarPago: contract.direccionLugarPago,
      obligacionesYFuncionesCargo: contract.obligacionesYFuncionesCargo,
      listaHerramientasYMateriales: contract.listaHerramientasYMateriales,
      incentivosAdicionales: contract.incentivosAdicionales,
      distritoFirma: contract.distritoFirma,
      fechaFirmaEnLetras: contract.fechaFirmaEnLetras,
      direccionInstalacionesEmpresa: contract.direccionInstalacionesEmpresa || '',
      ciudadJurisdiccionTribunales: contract.ciudadJurisdiccionTribunales || '',
      fechaIngreso: contract.fechaIngreso || '',
      sueldoBase: contract.sueldoBase || '',
      deduccionIsss: contract.deduccionIsss || '',
      deduccionAfp: contract.deduccionAfp || '',
      deduccionIsr: contract.deduccionIsr || '',
      deduccionOtros: contract.deduccionOtros || '',
      totalDeducciones: contract.totalDeducciones || '',
      otrosIngresos: contract.otrosIngresos || '',
      totalIngresos: contract.totalIngresos || '',
      liquidoAPagar: contract.liquidoAPagar || '',
      nombreRepresentanteRrhh: contract.nombreRepresentanteRrhh || '',
      cargoRepresentanteRrhh: contract.cargoRepresentanteRrhh || '',
      destinatarioInstitucionOPersona: contract.destinatarioInstitucionOPersona || '',
      ciudadEmision: contract.ciudadEmision || '',
      fechaEmisionEnLetras: contract.fechaEmisionEnLetras || '',
      employeeId: contract.employeeId,
      employeeName: contract.employeeName,
      branch: contract.branch,
      contractType: contract.contractType,
      startDate: contract.startDate,
      endDate: contract.endDate || '',
      salary: contract.salary,
      notes: contract.notes || '',
    });
    setDependientes(contract.dependientes?.length ? contract.dependientes : [emptyDependiente(), emptyDependiente()]);
    setShowDetail(null);
    setShowEdit(contract);
  };

  const filteredContracts = contracts.filter((c) => {
    const matchSearch = (c.employeeName || '').toLowerCase().includes(search.toLowerCase())
      || (c.branch || '').toLowerCase().includes(search.toLowerCase())
      || c.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'todos' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ----- DIALOG FORM CONTENT -----
  const renderForm = () => (
    <div className="space-y-3">
      {/* Vinculación rápida a empleado */}
      <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
        <Label className="text-xs font-bold mb-2 block">Vincular con empleado existente (opcional)</Label>
        <Select onValueChange={handleEmployeeSelect}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Seleccionar empleado para auto-llenar..." />
          </SelectTrigger>
          <SelectContent>
            {employees.filter((e) => e.status === 'active').map((emp) => (
              <SelectItem key={emp.id} value={emp.id.toString()}>{emp.name} — {emp.branch}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sección: Empresa */}
      <FormSectionHeader icon={Building} title="1. Datos de la Empresa" expanded={expandedSections.includes('empresa')} onToggle={() => toggleSection('empresa')} />
      {expandedSections.includes('empresa') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-1">
          <FormInput label="Razón Social" value={form.razonSocialEmpresa || ''} onChange={(v) => updateForm('razonSocialEmpresa', v)} placeholder="Ej: FLYNET S.A. DE C.V." required />
          <FormInput label="Abreviatura" value={form.abreviaturaEmpresa || ''} onChange={(v) => updateForm('abreviaturaEmpresa', v)} placeholder="Ej: FLYNET" />
          <FormInput label="Representante Legal" value={form.representanteLegalEmpresa || ''} onChange={(v) => updateForm('representanteLegalEmpresa', v)} placeholder="Nombre del representante legal" />
        </div>
      )}

      {/* Sección: Empleador */}
      <FormSectionHeader icon={User} title="2. Datos del Empleador (Representante)" expanded={expandedSections.includes('empleador')} onToggle={() => toggleSection('empleador')} />
      {expandedSections.includes('empleador') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-1">
          <FormInput label="Nombre Completo" value={form.nombreEmpleador || ''} onChange={(v) => updateForm('nombreEmpleador', v)} required />
          <FormInput label="DUI" value={form.duiEmpleador || ''} onChange={(v) => updateForm('duiEmpleador', v)} placeholder="00000000-0" />
          <FormInput label="NIT" value={form.nitEmpleador || ''} onChange={(v) => updateForm('nitEmpleador', v)} placeholder="0000-000000-000-0" />
          <FormInput label="Edad" value={form.edadEmpleador || ''} onChange={(v) => updateForm('edadEmpleador', v)} type="number" />
          <FormSelect label="Sexo" value={form.sexoEmpleador || ''} onChange={(v) => updateForm('sexoEmpleador', v)} options={['Masculino', 'Femenino']} />
          <FormInput label="Nacionalidad" value={form.nacionalidadEmpleador || ''} onChange={(v) => updateForm('nacionalidadEmpleador', v)} placeholder="Ej: Salvadoreño" />
          <FormSelect label="Estado Familiar" value={form.estadoFamiliarEmpleador || ''} onChange={(v) => updateForm('estadoFamiliarEmpleador', v)} options={['Soltero', 'Casado', 'Divorciado', 'Viudo', 'Acompañado']} />
          <FormInput label="Profesión/Oficio" value={form.profesionEmpleador || ''} onChange={(v) => updateForm('profesionEmpleador', v)} />
          <FormInput label="Domicilio" value={form.domicilioEmpleador || ''} onChange={(v) => updateForm('domicilioEmpleador', v)} />
          <FormInput label="Lugar Expedición DUI" value={form.lugarExpedicionDuiEmpleador || ''} onChange={(v) => updateForm('lugarExpedicionDuiEmpleador', v)} placeholder="Ej: San Salvador" />
          <FormInput label="Fecha Expedición DUI" value={form.fechaExpedicionDuiEmpleador || ''} onChange={(v) => updateForm('fechaExpedicionDuiEmpleador', v)} type="date" />
        </div>
      )}

      {/* Sección: Empleado */}
      <FormSectionHeader icon={IdCard} title="3. Datos del Empleado (Trabajador)" expanded={expandedSections.includes('empleado')} onToggle={() => toggleSection('empleado')} />
      {expandedSections.includes('empleado') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-1">
          <FormInput label="Nombre Completo" value={form.nombreEmpleado || ''} onChange={(v) => updateForm('nombreEmpleado', v)} required />
          <FormInput label="DUI" value={form.duiEmpleado || ''} onChange={(v) => updateForm('duiEmpleado', v)} placeholder="00000000-0" />
          <FormInput label="NIT" value={form.nitEmpleado || ''} onChange={(v) => updateForm('nitEmpleado', v)} placeholder="0000-000000-000-0" />
          <FormInput label="Edad" value={form.edadEmpleado || ''} onChange={(v) => updateForm('edadEmpleado', v)} type="number" />
          <FormSelect label="Sexo" value={form.sexoEmpleado || ''} onChange={(v) => updateForm('sexoEmpleado', v)} options={['Masculino', 'Femenino']} />
          <FormInput label="Nacionalidad" value={form.nacionalidadEmpleado || ''} onChange={(v) => updateForm('nacionalidadEmpleado', v)} placeholder="Ej: Salvadoreño" />
          <FormSelect label="Estado Familiar" value={form.estadoFamiliarEmpleado || ''} onChange={(v) => updateForm('estadoFamiliarEmpleado', v)} options={['Soltero', 'Casado', 'Divorciado', 'Viudo', 'Acompañado']} />
          <FormInput label="Profesión/Oficio" value={form.profesionEmpleado || ''} onChange={(v) => updateForm('profesionEmpleado', v)} />
          <FormInput label="Domicilio" value={form.domicilioEmpleado || ''} onChange={(v) => updateForm('domicilioEmpleado', v)} />
          <FormInput label="Residencia (Departamento)" value={form.residenciaEmpleado || ''} onChange={(v) => updateForm('residenciaEmpleado', v)} placeholder="Ej: San Salvador" />
          <FormInput label="Lugar Expedición DUI" value={form.lugarExpedicionDuiEmpleado || ''} onChange={(v) => updateForm('lugarExpedicionDuiEmpleado', v)} />
          <FormInput label="Fecha Expedición DUI" value={form.fechaExpedicionDuiEmpleado || ''} onChange={(v) => updateForm('fechaExpedicionDuiEmpleado', v)} type="date" />
        </div>
      )}

      {/* Sección: Dependientes */}
      <FormSectionHeader icon={Users} title="4. Dependientes del Empleado" expanded={expandedSections.includes('dependientes')} onToggle={() => toggleSection('dependientes')} />
      {expandedSections.includes('dependientes') && (
        <div className="space-y-4 px-1">
          {[0, 1].map((i) => (
            <Card key={i} className="border-dashed">
              <CardHeader className="p-3 pb-0">
                <CardTitle className="text-xs font-bold text-muted-foreground">Dependiente {i + 1}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <Input
                  className="h-9 text-sm"
                  placeholder="Nombres"
                  value={dependientes[i]?.nombre || ''}
                  onChange={(e) => updateDependiente(i, 'nombre', e.target.value)}
                />
                <Input
                  className="h-9 text-sm"
                  placeholder="Apellidos"
                  value={dependientes[i]?.apellido || ''}
                  onChange={(e) => updateDependiente(i, 'apellido', e.target.value)}
                />
                <Input
                  className="h-9 text-sm"
                  placeholder="Edad"
                  type="number"
                  value={dependientes[i]?.edad || ''}
                  onChange={(e) => updateDependiente(i, 'edad', e.target.value)}
                />
                <Input
                  className="h-9 text-sm"
                  placeholder="Parentesco"
                  value={dependientes[i]?.parentesco || ''}
                  onChange={(e) => updateDependiente(i, 'parentesco', e.target.value)}
                />
                <Input
                  className="h-9 text-sm"
                  placeholder="Dirección"
                  value={dependientes[i]?.direccion || ''}
                  onChange={(e) => updateDependiente(i, 'direccion', e.target.value)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sección: Contrato */}
      <FormSectionHeader icon={FileSignature} title="5. Condiciones del Contrato" expanded={expandedSections.includes('contrato')} onToggle={() => toggleSection('contrato')} />
      {expandedSections.includes('contrato') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-1">
          <FormInput label="Cargo / Puesto" value={form.cargoPuesto || ''} onChange={(v) => updateForm('cargoPuesto', v)} required />
          <FormSelect label="Tipo de Duración" value={form.tipoDuracionContrato || ''} onChange={(v) => updateForm('tipoDuracionContrato', v)} options={DURACION_TIPOS} />
          <FormInput label="Período del Contrato" value={form.periodoContrato || ''} onChange={(v) => updateForm('periodoContrato', v)} placeholder="Ej: Del 01/01/2026 al 31/12/2026" />
          <FormInput label="Fecha Inicio Servicio" value={form.fechaInicioServicio || ''} onChange={(v) => updateForm('fechaInicioServicio', v)} type="date" />
          <FormSelect label="Lugar de Prestación" value={form.lugarPrestacionServicios || ''} onChange={(v) => { updateForm('lugarPrestacionServicios', v); const branch = branches.find(b => b.name === v); if (branch?.direccion) updateForm('direccionPrestacionServicios', branch.direccion); }} options={branches.map(b => b.name)} placeholder="Seleccionar sucursal..." />
          <FormInput label="Dirección de Prestación" value={form.direccionPrestacionServicios || ''} onChange={(v) => updateForm('direccionPrestacionServicios', v)} />
          <FormInput label="Horas Semana Laboral" value={form.horasSemanaLaboral || ''} onChange={(v) => updateForm('horasSemanaLaboral', v)} placeholder="Ej: 44" />
          <FormInput label="Horario de Trabajo" value={form.horarioDeTrabajo || ''} onChange={(v) => updateForm('horarioDeTrabajo', v)} placeholder="Ej: L-V 8:00 AM - 5:00 PM" />
          <FormInput label="Salario en Números" value={form.salarioEnNumeros || ''} onChange={(v) => updateForm('salarioEnNumeros', v)} placeholder="Ej: $500.00" />
          <FormInput label="Salario en Letras" value={form.salarioEnLetras || ''} onChange={(v) => updateForm('salarioEnLetras', v)} placeholder="Ej: Quinientos dólares" />
          <FormSelect label="Forma y Período de Pago" value={form.formaYPeriodoPago || ''} onChange={(v) => updateForm('formaYPeriodoPago', v)} options={['Diario', 'Semanal', 'Quincenal', 'Mensual']} placeholder="Seleccionar período..." />
          <FormInput label="Nombre Empresa Pago" value={form.nombreEmpresaPago || ''} onChange={(v) => updateForm('nombreEmpresaPago', v)} />
          <FormInput label="Dirección Lugar Pago" value={form.direccionLugarPago || ''} onChange={(v) => updateForm('direccionLugarPago', v)} />
          <FormTextarea label="Obligaciones y Funciones" value={form.obligacionesYFuncionesCargo || ''} onChange={(v) => updateForm('obligacionesYFuncionesCargo', v)} placeholder="Describir las funciones del cargo..." />
          <FormTextarea label="Herramientas y Materiales" value={form.listaHerramientasYMateriales || ''} onChange={(v) => updateForm('listaHerramientasYMateriales', v)} placeholder="Lista de herramientas proporcionadas..." />
          <FormTextarea label="Incentivos Adicionales" value={form.incentivosAdicionales || ''} onChange={(v) => updateForm('incentivosAdicionales', v)} placeholder="Bonos, comisiones, etc..." />
        </div>
      )}

      {/* Sección: Firma */}
      <FormSectionHeader icon={MapPin} title="6. Datos de Firma" expanded={expandedSections.includes('firma')} onToggle={() => toggleSection('firma')} />
      {expandedSections.includes('firma') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-1">
          <FormInput label="Distrito de Firma" value={form.distritoFirma || ''} onChange={(v) => updateForm('distritoFirma', v)} placeholder="Ej: San Salvador" />
          <FormInput label="Fecha de Firma (en letras)" value={form.fechaFirmaEnLetras || ''} onChange={(v) => updateForm('fechaFirmaEnLetras', v)} placeholder="Ej: A los diez días del mes de enero de dos mil veintiséis" />
          <div className="sm:col-span-2">
            <FormTextarea label="Notas internas" value={form.notes || ''} onChange={(v) => updateForm('notes', v)} placeholder="Notas administrativas (no visibles en el contrato)..." rows={2} />
          </div>
        </div>
      )}

      {/* Sección: Confidencialidad */}
      <FormSectionHeader icon={Shield} title="7. Datos para Carta de Confidencialidad" expanded={expandedSections.includes('confidencialidad')} onToggle={() => toggleSection('confidencialidad')} />
      {expandedSections.includes('confidencialidad') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-1">
          <FormInput label="Dirección Instalaciones Empresa" value={form.direccionInstalacionesEmpresa || ''} onChange={(v) => updateForm('direccionInstalacionesEmpresa', v)} placeholder="Ej: 16ª Calle Poniente y Ruta Militar, Barrio San Felipe" />
          <FormInput label="Ciudad Jurisdicción Tribunales" value={form.ciudadJurisdiccionTribunales || ''} onChange={(v) => updateForm('ciudadJurisdiccionTribunales', v)} placeholder="Ej: San Miguel" />
        </div>
      )}

      {/* Sección: Constancia de Salario */}
      <FormSectionHeader icon={Receipt} title="8. Datos para Constancia de Salario" expanded={expandedSections.includes('constancia')} onToggle={() => toggleSection('constancia')} />
      {expandedSections.includes('constancia') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-1">
          <FormInput label="Fecha de Ingreso" value={form.fechaIngreso || ''} onChange={(v) => updateForm('fechaIngreso', v)} type="date" />
          <FormInput label="Sueldo Base" value={form.sueldoBase || ''} onChange={(v) => updateForm('sueldoBase', v)} placeholder="Ej: $410.00" />
          <FormInput label="Deducción ISSS" value={form.deduccionIsss || ''} onChange={(v) => updateForm('deduccionIsss', v)} placeholder="Ej: $13.50" />
          <FormInput label="Deducción AFP" value={form.deduccionAfp || ''} onChange={(v) => updateForm('deduccionAfp', v)} placeholder="Ej: $32.63" />
          <FormInput label="Deducción ISR" value={form.deduccionIsr || ''} onChange={(v) => updateForm('deduccionIsr', v)} placeholder="Ej: $0.00" />
          <FormInput label="Otras Deducciones" value={form.deduccionOtros || ''} onChange={(v) => updateForm('deduccionOtros', v)} placeholder="Ej: $0.00" />
          <FormInput label="Total Deducciones" value={form.totalDeducciones || ''} onChange={(v) => updateForm('totalDeducciones', v)} placeholder="Ej: $46.13" />
          <FormInput label="Otros Ingresos" value={form.otrosIngresos || ''} onChange={(v) => updateForm('otrosIngresos', v)} placeholder="Ej: $0.00" />
          <FormInput label="Total Ingresos" value={form.totalIngresos || ''} onChange={(v) => updateForm('totalIngresos', v)} placeholder="Ej: $410.00" />
          <FormInput label="Líquido a Pagar" value={form.liquidoAPagar || ''} onChange={(v) => updateForm('liquidoAPagar', v)} placeholder="Ej: $403.87" />
          <FormInput label="Nombre Representante RRHH" value={form.nombreRepresentanteRrhh || ''} onChange={(v) => updateForm('nombreRepresentanteRrhh', v)} placeholder="Ej: Licdo. Pedro Vicente Chicas" />
          <FormInput label="Cargo Representante RRHH" value={form.cargoRepresentanteRrhh || ''} onChange={(v) => updateForm('cargoRepresentanteRrhh', v)} placeholder="Ej: Recursos Humanos" />
          <FormInput label="Destinatario (Institución/Persona)" value={form.destinatarioInstitucionOPersona || ''} onChange={(v) => updateForm('destinatarioInstitucionOPersona', v)} placeholder="Ej: Avance y Desarrollo" />
          <FormInput label="Ciudad de Emisión" value={form.ciudadEmision || ''} onChange={(v) => updateForm('ciudadEmision', v)} placeholder="Ej: San Miguel" />
          <FormInput label="Fecha de Emisión (en letras)" value={form.fechaEmisionEnLetras || ''} onChange={(v) => updateForm('fechaEmisionEnLetras', v)} placeholder="Ej: A los siete días del mes de enero de dos mil veintiséis" />
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
            <FileSignature className="h-6 w-6 text-primary" /> Gestión de Contratos
          </h1>
          <p className="text-sm text-muted-foreground">Contratos laborales, cartas de confidencialidad y constancias de salario.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo Contrato
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nombre, sucursal o ID..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="generado">Generado</SelectItem>
                <SelectItem value="firmado">Firmado</SelectItem>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[120px]">ID</TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">Salario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Documentos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      <FileSignature className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      No hay contratos registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContracts.map((c) => {
                    const status = STATUS_MAP[c.status] || STATUS_MAP.pendiente;
                    const StatusIcon = status.icon;
                    const hasGen = !!c.contractGeneratedUrl;
                    const hasSig = !!c.contractSignedUrl;
                    const hasConf = !!c.confidentialityGeneratedUrl;
                    const hasConfSig = !!c.confidentialitySignedUrl;
                    const hasSalary = !!c.salaryCertificateUrl;
                    const totalDocs = [hasGen, hasSig, hasConf, hasConfSig, hasSalary].filter(Boolean).length;

                    return (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setShowDetail(c)}>
                        <TableCell className="font-mono text-xs">{c.id}</TableCell>
                        <TableCell className="font-medium">{c.nombreEmpleado || c.employeeName}</TableCell>
                        <TableCell className="text-sm">{c.cargoPuesto}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{c.salarioEnNumeros || `$${c.salary}`}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" /> {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {hasGen && <span title="Contrato generado"><FileText className="h-4 w-4 text-blue-500" /></span>}
                            {hasSig && <span title="Contrato firmado"><CheckCircle2 className="h-4 w-4 text-green-500" /></span>}
                            {hasConf && <span title="Confidencialidad generada"><Shield className="h-4 w-4 text-purple-500" /></span>}
                            {hasConfSig && <span title="Confidencialidad firmada"><Shield className="h-4 w-4 text-green-500" /></span>}
                            {hasSalary && <span title="Constancia de salario"><Receipt className="h-4 w-4 text-amber-500" /></span>}
                            {totalDocs === 0 && <span className="text-xs text-muted-foreground">--</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setShowDetail(c); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* ===== DIALOG: CREAR CONTRATO ===== */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Nuevo Contrato Laboral</DialogTitle>
            <DialogDescription>Completa todos los campos requeridos. Puedes expandir/colapsar cada sección.</DialogDescription>
          </DialogHeader>
          {renderForm()}
          <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Crear Contrato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG: EDITAR CONTRATO ===== */}
      <Dialog open={!!showEdit} onOpenChange={() => setShowEdit(null)}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit3 className="h-5 w-5 text-primary" /> Editar Contrato</DialogTitle>
            <DialogDescription>Modifica los campos necesarios y guarda los cambios.</DialogDescription>
          </DialogHeader>
          {renderForm()}
          <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
            <Button variant="outline" onClick={() => setShowEdit(null)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG: DETALLE ===== */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {showDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileSignature className="h-5 w-5 text-primary" /> Contrato {showDetail.id}
                </DialogTitle>
                <DialogDescription>Creado el {new Date(showDetail.createdAt).toLocaleDateString('es-SV')}</DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="info" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="info" className="flex-1">Información</TabsTrigger>
                  <TabsTrigger value="docs" className="flex-1">Documentos</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      ['Empleado', showDetail.nombreEmpleado],
                      ['DUI Empleado', showDetail.duiEmpleado],
                      ['NIT Empleado', showDetail.nitEmpleado],
                      ['Cargo', showDetail.cargoPuesto],
                      ['Empresa', showDetail.razonSocialEmpresa],
                      ['Empleador', showDetail.nombreEmpleador],
                      ['Salario', showDetail.salarioEnNumeros],
                      ['Tipo Duración', showDetail.tipoDuracionContrato],
                      ['Inicio Servicio', showDetail.fechaInicioServicio],
                      ['Lugar', showDetail.lugarPrestacionServicios],
                      ['Horario', showDetail.horarioDeTrabajo],
                      ['Forma de Pago', showDetail.formaYPeriodoPago],
                      ['Distrito Firma', showDetail.distritoFirma],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={label} className="space-y-0.5">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <p className="font-medium">{value}</p>
                      </div>
                    ))}
                  </div>

                  {showDetail.obligacionesYFuncionesCargo && (
                    <div className="p-3 bg-muted rounded-lg">
                      <span className="text-xs font-bold text-muted-foreground">Obligaciones y Funciones</span>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{showDetail.obligacionesYFuncionesCargo}</p>
                    </div>
                  )}

                  <Separator />
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold">Estado:</span>
                    <Select value={showDetail.status} onValueChange={(v) => handleStatusChange(showDetail, v)}>
                      <SelectTrigger className="h-8 w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                        <SelectItem value="generado">Generado</SelectItem>
                        <SelectItem value="firmado">Firmado</SelectItem>
                        <SelectItem value="activo">Activo</SelectItem>
                        <SelectItem value="vencido">Vencido</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => openEdit(showDetail)}>
                      <Edit3 className="h-3 w-3 mr-1" /> Editar
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="docs" className="space-y-4 pt-4">
                  {['Contrato Laboral', 'Carta de Confidencialidad', 'Constancia de Salario'].map((docName, i) => {
                    const isContrato = i === 0;
                    const isConf = i === 1;
                    const genUrl = isContrato ? showDetail.contractGeneratedUrl : isConf ? showDetail.confidentialityGeneratedUrl : showDetail.salaryCertificateUrl;
                    const signedUrl = isContrato ? showDetail.contractSignedUrl : isConf ? showDetail.confidentialitySignedUrl : undefined;
                    const genType = isContrato ? 'contrato' : isConf ? 'confidencialidad' : 'salario';
                    const signedType = isContrato ? 'contract_signed' : 'confidentiality_signed';
                    const color = isContrato ? 'blue' : isConf ? 'purple' : 'amber';
                    const Icon = isContrato ? FileText : isConf ? Shield : Receipt;

                    return (
                      <Card key={docName}>
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Icon className={`h-4 w-4 text-${color}-500`} /> {docName}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-2">
                          {genUrl ? (
                            <div className={`flex items-center justify-between p-2 bg-${color}-50 rounded-lg`}>
                              <span className={`text-sm text-${color}-700 flex items-center gap-2`}>
                                <CheckCircle2 className="h-4 w-4" /> Generado
                              </span>
                              <Button size="sm" variant="outline" onClick={() => window.open(genUrl, '_blank')}>
                                <Download className="h-3 w-3 mr-1" /> Descargar
                              </Button>
                            </div>
                          ) : (
                            <Button variant="outline" size="sm" className="w-full" onClick={() => setShowGenerate({ contract: showDetail, type: genType })}>
                              <FileText className="h-4 w-4 mr-2" /> Generar {docName}
                            </Button>
                          )}

                          {signedType && (
                            <>
                              <Separator />
                              <div className="flex items-center justify-between">
                                <span className="text-sm">Firmado</span>
                                {signedUrl ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-green-600 flex items-center gap-1">
                                      <CheckCircle2 className="h-4 w-4" /> Subido
                                    </span>
                                    <Button size="sm" variant="outline" onClick={() => window.open(signedUrl, '_blank')}>
                                      <Download className="h-3 w-3 mr-1" /> Ver
                                    </Button>
                                  </div>
                                ) : (
                                  <label className="cursor-pointer">
                                    <Button size="sm" variant="outline" asChild>
                                      <span><Upload className="h-3 w-3 mr-1" /> Subir Firmado</span>
                                    </Button>
                                    <input type="file" className="hidden" accept=".pdf,.docx,.jpg,.jpeg,.png"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          setShowUpload({ contract: showDetail, type: signedType, label: `${docName} Firmado` });
                                          handleUpload(file);
                                        }
                                      }}
                                    />
                                  </label>
                                )}
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </TabsContent>
              </Tabs>

              <DialogFooter className="flex justify-between">
                <Button variant="destructive" size="sm" onClick={() => handleDelete(showDetail.id)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                </Button>
                <Button variant="outline" onClick={() => setShowDetail(null)}>Cerrar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG: REVISIÓN PREVIA Y GENERAR ===== */}
      <Dialog open={!!showGenerate} onOpenChange={() => setShowGenerate(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {showGenerate?.type === 'contrato' ? 'Revisar Contrato Laboral'
                : showGenerate?.type === 'confidencialidad' ? 'Revisar Carta de Confidencialidad'
                : 'Revisar Constancia de Salario'}
            </DialogTitle>
            <DialogDescription>
              Revisa los datos antes de generar el documento.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[55vh] pr-4">
            <div className="space-y-4 text-sm">
              {/* Empresa */}
              <div className="border rounded-lg p-3">
                <h4 className="font-bold text-xs text-primary mb-2 flex items-center gap-1"><Building className="h-3.5 w-3.5" /> DATOS DE LA EMPRESA</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <PreviewRow label="Razón Social" value={showGenerate?.contract.razonSocialEmpresa} />
                  <PreviewRow label="Abreviatura" value={showGenerate?.contract.abreviaturaEmpresa} />
                  <PreviewRow label="Rep. Legal" value={showGenerate?.contract.representanteLegalEmpresa} />
                </div>
              </div>

              {/* Empleador */}
              <div className="border rounded-lg p-3">
                <h4 className="font-bold text-xs text-primary mb-2 flex items-center gap-1"><User className="h-3.5 w-3.5" /> DATOS DEL EMPLEADOR</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <PreviewRow label="Nombre" value={showGenerate?.contract.nombreEmpleador} />
                  <PreviewRow label="DUI" value={showGenerate?.contract.duiEmpleador} />
                  <PreviewRow label="NIT" value={showGenerate?.contract.nitEmpleador} />
                  <PreviewRow label="Edad" value={showGenerate?.contract.edadEmpleador} />
                  <PreviewRow label="Sexo" value={showGenerate?.contract.sexoEmpleador} />
                  <PreviewRow label="Nacionalidad" value={showGenerate?.contract.nacionalidadEmpleador} />
                  <PreviewRow label="Estado Familiar" value={showGenerate?.contract.estadoFamiliarEmpleador} />
                  <PreviewRow label="Profesión" value={showGenerate?.contract.profesionEmpleador} />
                  <PreviewRow label="Domicilio" value={showGenerate?.contract.domicilioEmpleador} span />
                </div>
              </div>

              {/* Empleado */}
              <div className="border rounded-lg p-3">
                <h4 className="font-bold text-xs text-primary mb-2 flex items-center gap-1"><IdCard className="h-3.5 w-3.5" /> DATOS DEL EMPLEADO</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <PreviewRow label="Nombre" value={showGenerate?.contract.nombreEmpleado} />
                  <PreviewRow label="DUI" value={showGenerate?.contract.duiEmpleado} />
                  <PreviewRow label="NIT" value={showGenerate?.contract.nitEmpleado} />
                  <PreviewRow label="Edad" value={showGenerate?.contract.edadEmpleado} />
                  <PreviewRow label="Sexo" value={showGenerate?.contract.sexoEmpleado} />
                  <PreviewRow label="Nacionalidad" value={showGenerate?.contract.nacionalidadEmpleado} />
                  <PreviewRow label="Estado Familiar" value={showGenerate?.contract.estadoFamiliarEmpleado} />
                  <PreviewRow label="Profesión" value={showGenerate?.contract.profesionEmpleado} />
                  <PreviewRow label="Domicilio" value={showGenerate?.contract.domicilioEmpleado} span />
                  <PreviewRow label="Residencia" value={showGenerate?.contract.residenciaEmpleado} span />
                </div>
              </div>

              {/* Condiciones */}
              <div className="border rounded-lg p-3">
                <h4 className="font-bold text-xs text-primary mb-2 flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> CONDICIONES DEL CONTRATO</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <PreviewRow label="Cargo/Puesto" value={showGenerate?.contract.cargoPuesto} />
                  <PreviewRow label="Tipo Duración" value={showGenerate?.contract.tipoDuracionContrato} />
                  <PreviewRow label="Período" value={showGenerate?.contract.periodoContrato} />
                  <PreviewRow label="Fecha Inicio" value={showGenerate?.contract.fechaInicioServicio} />
                  <PreviewRow label="Lugar Prestación" value={showGenerate?.contract.lugarPrestacionServicios} />
                  <PreviewRow label="Dirección" value={showGenerate?.contract.direccionPrestacionServicios} span />
                  <PreviewRow label="Horas/Semana" value={showGenerate?.contract.horasSemanaLaboral} />
                  <PreviewRow label="Horario" value={showGenerate?.contract.horarioDeTrabajo} span />
                </div>
              </div>

              {/* Salario */}
              <div className="border rounded-lg p-3">
                <h4 className="font-bold text-xs text-primary mb-2 flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> SALARIO Y PAGO</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <PreviewRow label="Salario (Núm.)" value={showGenerate?.contract.salarioEnNumeros} />
                  <PreviewRow label="Salario (Letras)" value={showGenerate?.contract.salarioEnLetras} />
                  <PreviewRow label="Forma/Período" value={showGenerate?.contract.formaYPeriodoPago} />
                  <PreviewRow label="Empresa que paga" value={showGenerate?.contract.nombreEmpresaPago} />
                  <PreviewRow label="Dirección de pago" value={showGenerate?.contract.direccionLugarPago} span />
                </div>
              </div>

              {/* Firma y fechas */}
              <div className="border rounded-lg p-3">
                <h4 className="font-bold text-xs text-primary mb-2 flex items-center gap-1"><FileSignature className="h-3.5 w-3.5" /> FIRMA Y FECHAS</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <PreviewRow label="Distrito de Firma" value={showGenerate?.contract.distritoFirma} />
                  <PreviewRow label="Fecha Firma (Letras)" value={showGenerate?.contract.fechaFirmaEnLetras} />
                  <PreviewRow label="Ciudad Jurisdicción" value={showGenerate?.contract.ciudadJurisdiccionTribunales} />
                  <PreviewRow label="Ciudad Emisión" value={showGenerate?.contract.ciudadEmision} />
                  <PreviewRow label="Fecha Emisión (Letras)" value={showGenerate?.contract.fechaEmisionEnLetras} />
                </div>
              </div>

              {/* Campos específicos de constancia */}
              {showGenerate?.type === 'salario' && (
                <div className="border rounded-lg p-3">
                  <h4 className="font-bold text-xs text-primary mb-2 flex items-center gap-1"><Receipt className="h-3.5 w-3.5" /> DETALLE DE SALARIO</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <PreviewRow label="Sueldo Base" value={showGenerate?.contract.sueldoBase} />
                    <PreviewRow label="Fecha Ingreso" value={showGenerate?.contract.fechaIngreso} />
                    <PreviewRow label="Ded. ISSS" value={showGenerate?.contract.deduccionIsss} />
                    <PreviewRow label="Ded. AFP" value={showGenerate?.contract.deduccionAfp} />
                    <PreviewRow label="Ded. ISR" value={showGenerate?.contract.deduccionIsr} />
                    <PreviewRow label="Ded. Otros" value={showGenerate?.contract.deduccionOtros} />
                    <PreviewRow label="Total Deducciones" value={showGenerate?.contract.totalDeducciones} />
                    <PreviewRow label="Otros Ingresos" value={showGenerate?.contract.otrosIngresos} />
                    <PreviewRow label="Total Ingresos" value={showGenerate?.contract.totalIngresos} />
                    <PreviewRow label="Líquido a Pagar" value={showGenerate?.contract.liquidoAPagar} />
                    <PreviewRow label="RRHH Representante" value={showGenerate?.contract.nombreRepresentanteRrhh} />
                    <PreviewRow label="Cargo RRHH" value={showGenerate?.contract.cargoRepresentanteRrhh} />
                    <PreviewRow label="Destinatario" value={showGenerate?.contract.destinatarioInstitucionOPersona} span />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowGenerate(null)}>Cancelar</Button>
            <Button onClick={handleGenerate}><Download className="h-4 w-4 mr-2" /> Generar y Descargar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG: SUBIR ===== */}
      <Dialog open={!!showUpload} onOpenChange={() => setShowUpload(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subiendo archivo...</DialogTitle>
            <DialogDescription>{showUpload?.label}</DialogDescription>
          </DialogHeader>
          <div className="py-8 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Procesando...</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG: SELECCIONAR EMPRESA ===== */}
      <Dialog open={showCompanySelect} onOpenChange={() => setShowCompanySelect(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" /> Seleccionar Empresa
            </DialogTitle>
            <DialogDescription>
              Elige con qué empresa/subsidiaria deseas generar este contrato.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {companyProfiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => { setSelectedCompanyId(profile.id); handleCompanySelected(); }}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all hover:border-primary hover:bg-primary/5 ${
                  selectedCompanyId === profile.id ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Building className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-bold text-sm">{profile.nombre}</p>
                    <p className="text-xs text-muted-foreground">{profile.razonSocialEmpresa || profile.abreviaturaEmpresa || 'Sin razón social'}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompanySelect(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
