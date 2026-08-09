'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { CompanyProfile, CompanyDefaults } from '@/lib/types';
import {
  Building, User, MapPin, Shield, Users, Loader2, Save, Database,
  Plus, Trash2, Edit3, CheckCircle2, ChevronDown, ChevronUp,
} from 'lucide-react';

const DEFAULT_LABELS: Record<string, { section: string; label: string; placeholder: string }> = {
  razonSocialEmpresa: { section: '1. Empresa', label: 'Razón Social', placeholder: 'Ej: FLYNET S.A. DE C.V.' },
  abreviaturaEmpresa: { section: '1. Empresa', label: 'Abreviatura', placeholder: 'Ej: FLYNET' },
  representanteLegalEmpresa: { section: '1. Empresa', label: 'Representante Legal', placeholder: 'Nombre del representante legal' },
  nombreEmpleador: { section: '2. Empleador', label: 'Nombre Completo', placeholder: 'Nombre del empleador/representante' },
  duiEmpleador: { section: '2. Empleador', label: 'DUI', placeholder: '00000000-0' },
  nitEmpleador: { section: '2. Empleador', label: 'NIT', placeholder: '0000-000000-000-0' },
  edadEmpleador: { section: '2. Empleador', label: 'Edad', placeholder: '' },
  sexoEmpleador: { section: '2. Empleador', label: 'Sexo', placeholder: '' },
  nacionalidadEmpleador: { section: '2. Empleador', label: 'Nacionalidad', placeholder: 'Ej: Salvadoreño' },
  estadoFamiliarEmpleador: { section: '2. Empleador', label: 'Estado Familiar', placeholder: '' },
  profesionEmpleador: { section: '2. Empleador', label: 'Profesión/Oficio', placeholder: '' },
  domicilioEmpleador: { section: '2. Empleador', label: 'Domicilio', placeholder: '' },
  lugarExpedicionDuiEmpleador: { section: '2. Empleador', label: 'Lugar Expedición DUI', placeholder: 'Ej: San Salvador' },
  fechaExpedicionDuiEmpleador: { section: '2. Empleador', label: 'Fecha Expedición DUI', placeholder: '' },
  distritoFirma: { section: '6. Firma', label: 'Distrito de Firma', placeholder: 'Ej: San Salvador' },
  fechaFirmaEnLetras: { section: '6. Firma', label: 'Fecha de Firma (en letras)', placeholder: 'Ej: A los diez días del mes de enero de dos mil veintiséis' },
  direccionInstalacionesEmpresa: { section: '7. Confidencialidad', label: 'Dirección Instalaciones', placeholder: 'Ej: 16ª Calle Poniente, Barrio San Felipe' },
  ciudadJurisdiccionTribunales: { section: '7. Confidencialidad', label: 'Ciudad Jurisdicción Tribunales', placeholder: 'Ej: San Miguel' },
  nombreRepresentanteRrhh: { section: '8. RRHH', label: 'Nombre Representante RRHH', placeholder: 'Ej: Licdo. Pedro Vicente Chicas' },
  cargoRepresentanteRrhh: { section: '8. RRHH', label: 'Cargo Representante RRHH', placeholder: 'Ej: Recursos Humanos' },
};

const SECTION_ORDER = ['1. Empresa', '2. Empleador', '6. Firma', '7. Confidencialidad', '8. RRHH'];
const SECTION_ICONS: Record<string, any> = {
  '1. Empresa': Building,
  '2. Empleador': User,
  '6. Firma': MapPin,
  '7. Confidencialidad': Shield,
  '8. RRHH': Users,
};

const SEXO_OPTIONS = ['Masculino', 'Femenino'];
const ESTADO_OPTIONS = ['Soltero', 'Casado', 'Divorciado', 'Viudo', 'Acompañado'];

function isSelectField(field: string): string[] | null {
  if (field === 'sexoEmpleador') return SEXO_OPTIONS;
  if (field === 'estadoFamiliarEmpleador') return ESTADO_OPTIONS;
  return null;
}

function isDateField(field: string): boolean {
  return field === 'fechaExpedicionDuiEmpleador';
}

const defaultForm: CompanyDefaults = {
  razonSocialEmpresa: '',
  abreviaturaEmpresa: '',
  representanteLegalEmpresa: '',
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
  distritoFirma: '',
  fechaFirmaEnLetras: '',
  direccionInstalacionesEmpresa: '',
  ciudadJurisdiccionTribunales: '',
  nombreRepresentanteRrhh: '',
  cargoRepresentanteRrhh: '',
};

export default function DatosCPage() {
  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyDefaults>({ ...defaultForm });
  const [empresaNombre, setEmpresaNombre] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['1. Empresa']);

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/datos-c');
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
        if (data.length > 0 && !selectedId) {
          setSelectedId(data[0].id);
        }
      }
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  }, [selectedId]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  // Cargar perfil seleccionado al formulario
  useEffect(() => {
    if (!selectedId) {
      setForm({ ...defaultForm });
      setEmpresaNombre('');
      return;
    }
    const profile = profiles.find((p) => p.id === selectedId);
    if (profile) {
      setForm({
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
      setEmpresaNombre(profile.nombre);
    }
  }, [selectedId, profiles]);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!empresaNombre.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/datos-c', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedId, nombre: empresaNombre, ...form }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        await fetchProfiles();
      }
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const handleCreateNew = async () => {
    const nombre = prompt('Nombre de la nueva empresa/subsidiaria:');
    if (!nombre?.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/datos-c', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), ...defaultForm }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchProfiles();
        setSelectedId(data.id);
      }
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      await fetch(`/api/admin/datos-c?id=${encodeURIComponent(selectedId)}`, { method: 'DELETE' });
      setShowDeleteConfirm(false);
      setSelectedId(null);
      await fetchProfiles();
    } catch (e) { console.error(e); }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const SectionHeader = ({ icon: Icon, title, section }: { icon: any; title: string; section: string }) => (
    <button
      type="button"
      className="flex items-center gap-3 w-full py-3 px-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
      onClick={() => toggleSection(section)}
    >
      <Icon className="h-5 w-5 text-primary" />
      <span className="font-bold text-sm">{title}</span>
      <div className="flex-1" />
      {expandedSections.includes(section) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </button>
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
            <Database className="h-6 w-6 text-primary" /> Datos por Defecto — Empresas
          </h1>
          <p className="text-sm text-muted-foreground">
            Configura los datos de cada empresa/subsidiaria. Al crear un contrato podrás elegir con cuál generarlo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" /> Nueva Empresa
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !empresaNombre.trim()} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saved ? '¡Guardado!' : 'Guardar'}
          </Button>
        </div>
      </div>

      {profiles.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground mb-4">No hay empresas configuradas todavía.</p>
            <Button onClick={handleCreateNew} className="gap-2">
              <Plus className="h-4 w-4" /> Crear Primera Empresa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Lista de empresas */}
          <Card className="lg:col-span-1 h-fit">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">Empresas</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="space-y-1">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors ${
                      selectedId === p.id
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building className="h-4 w-4 shrink-0" />
                      <span className="text-sm truncate">{p.nombre}</span>
                    </div>
                    {selectedId === p.id && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Formulario */}
          <div className="lg:col-span-3 space-y-4">
            {/* Nombre de la empresa */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs">Nombre de la Empresa</Label>
                    <Input
                      className="h-9"
                      value={empresaNombre}
                      onChange={(e) => { setEmpresaNombre(e.target.value); setSaved(false); }}
                      placeholder="Ej: FLYNET S.A. DE C.V."
                    />
                  </div>
                  {profiles.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="gap-1 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" /> Eliminar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Secciones de datos */}
            {SECTION_ORDER.map((section) => {
              const Icon = SECTION_ICONS[section] || Building;
              const fields = Object.entries(DEFAULT_LABELS).filter(([, v]) => v.section === section);

              return (
                <Card key={section}>
                  <CardHeader className="p-4 pb-2">
                    <button
                      type="button"
                      className="flex items-center gap-2 w-full text-left"
                      onClick={() => toggleSection(section)}
                    >
                      <Icon className="h-4 w-4 text-primary" />
                      <CardTitle className="text-sm flex-1">{section}</CardTitle>
                      {expandedSections.includes(section) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <CardDescription className="text-xs">
                      Datos que se usarán por defecto en {section.toLowerCase()}.
                    </CardDescription>
                  </CardHeader>
                  {expandedSections.includes(section) && (
                    <CardContent className="p-4 pt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {fields.map(([field, { label, placeholder }]) => {
                          const selectOptions = isSelectField(field);
                          const isDate = isDateField(field);
                          const value = (form as any)[field] || '';

                          if (selectOptions) {
                            return (
                              <div key={field} className="space-y-1.5">
                                <Label className="text-xs">{label}</Label>
                                <Select value={value} onValueChange={(v) => updateField(field, v)}>
                                  <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Seleccionar..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {selectOptions.map((opt) => (
                                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          }

                          return (
                            <div key={field} className="space-y-1.5">
                              <Label className="text-xs">{label}</Label>
                              <Input
                                type={isDate ? 'date' : 'text'}
                                className="h-9 text-sm"
                                value={value}
                                onChange={(e) => updateField(field, e.target.value)}
                                placeholder={placeholder}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Diálogo confirmar eliminar */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Empresa</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar "{empresaNombre}"? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
