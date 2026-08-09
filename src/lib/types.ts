export type Employee = {
  id: number;
  name: string;
  status: 'active' | 'inactive';
  salary: number;
  pin?: string;
  branch: string;
  position?: string;
  isSupervisor?: boolean;
  // Datos personales (llenados desde Contratos)
  dui?: string;
  nit?: string;
  edad?: string;
  sexo?: string;
  nacionalidad?: string;
  estadoFamiliar?: string;
  profesion?: string;
  domicilio?: string;
  residencia?: string;
  lugarExpedicionDui?: string;
  fechaExpedicionDui?: string;
};

export type Branch = {
  id: number;
  name: string;
  deviceId?: string | null;
  isUnrestricted?: boolean;
  isAttendanceEnabled?: boolean;
  direccion?: string;
};

export type OvertimeRecord = {
  id: string;
  date: Date;
  startTime: string; // e.g., "04:30 PM"
  endTime: string; // e.g., "11:00 PM"
  activity: string;
  coworkers: string;
  quincena: 1 | 2;
  totalHours: number;
  dayHours: number;
  nightHours: number;
  createdAt?: string; // ISO string
  deviceInfo?: string;
  status: 'pending' | 'approved' | 'rejected';
  type: 'overtime' | 'additional_day';
  adminNotes?: string;
};

export type AttendanceRecord = {
  id: string;
  timestamp: string; // ISO string
  type: 'in' | 'out';
  deviceInfo: string;
  employeeName: string;
  employeeId?: number;
  branch: string;
  date: string; // YYYY-MM-DD for easy filtering
};

export type PermitRequest = {
  [x: string]: any;
  id: string;
  requestDate: string;
  employeeName: string;
  branch: string;
  position: string;
  startDate: string;
  endDate: string;
  action: string;
  supervisorName: string;
  justification: string;
  status: 'pending' | 'pending_admin' | 'approved' | 'rejected';
  resolvedAt?: string;
  adminNotes?: string;
  approvedBySupervisorAt?: string;
  approvedByAdminAt?: string;
  approvedByAdminName?: string;
  evidence?: string;
  eventuality?: string;
  evidenceFileDataUri?: string;
};

export type UserNotification = {
  id: string;
  recipientName: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  type: 'info' | 'alert' | 'success';
  sender: string;
};

export type WarningRecord = {
  id: string;
  date: string; // Fecha de emisión
  employeeId: string;
  employeeName: string;
  incidentDate: string; // Fecha de la falta
  dui: string;
  position: string;
  comments: string; // Derecho a descargo
  createdAt: string;
};

export type EmployeeHistoryRecord = {
  id: string;
  employeeName: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  uploadDate: string;
  notes?: string;
};

export type Dependiente = {
  nombre: string;
  apellido: string;
  edad: string;
  parentesco: string;
  direccion: string;
};

export type CompanyDefaults = {
  // Datos de la Empresa
  razonSocialEmpresa: string;
  abreviaturaEmpresa: string;
  representanteLegalEmpresa: string;

  // Datos del Empleador
  nombreEmpleador: string;
  duiEmpleador: string;
  nitEmpleador: string;
  edadEmpleador: string;
  sexoEmpleador: string;
  nacionalidadEmpleador: string;
  estadoFamiliarEmpleador: string;
  profesionEmpleador: string;
  domicilioEmpleador: string;
  lugarExpedicionDuiEmpleador: string;
  fechaExpedicionDuiEmpleador: string;

  // Datos de Firma
  distritoFirma: string;
  fechaFirmaEnLetras: string;

  // Datos de Confidencialidad
  direccionInstalacionesEmpresa: string;
  ciudadJurisdiccionTribunales: string;

  // Datos RRHH
  nombreRepresentanteRrhh: string;
  cargoRepresentanteRrhh: string;
};

export type CompanyProfile = CompanyDefaults & {
  id: string;
  nombre: string;
};

export type ContractRecord = {
  id: string;
  employeeId: number;
  status: 'pendiente' | 'generado' | 'firmado' | 'activo' | 'vencido';

  // Documentos
  contractGeneratedUrl?: string;
  contractSignedUrl?: string;
  confidentialityGeneratedUrl?: string;
  confidentialitySignedUrl?: string;
  salaryCertificateUrl?: string;

  // Datos de la Empresa
  razonSocialEmpresa: string;
  abreviaturaEmpresa: string;

  // Datos del Empleador (Representante Legal)
  nombreEmpleador: string;
  duiEmpleador: string;
  nitEmpleador: string;
  edadEmpleador: string;
  sexoEmpleador: string;
  nacionalidadEmpleador: string;
  estadoFamiliarEmpleador: string;
  profesionEmpleador: string;
  domicilioEmpleador: string;
  lugarExpedicionDuiEmpleador: string;
  fechaExpedicionDuiEmpleador: string;

  // Datos del Empleado
  nombreEmpleado: string;
  duiEmpleado: string;
  nitEmpleado: string;
  edadEmpleado: string;
  sexoEmpleado: string;
  nacionalidadEmpleado: string;
  estadoFamiliarEmpleado: string;
  profesionEmpleado: string;
  domicilioEmpleado: string;
  residenciaEmpleado: string;
  lugarExpedicionDuiEmpleado: string;
  fechaExpedicionDuiEmpleado: string;

  // Datos del Contrato
  cargoPuesto: string;
  representanteLegalEmpresa: string;
  tipoDuracionContrato: string;
  periodoContrato: string;
  fechaInicioServicio: string;
  lugarPrestacionServicios: string;
  direccionPrestacionServicios: string;
  horasSemanaLaboral: string;
  horarioDeTrabajo: string;
  salarioEnNumeros: string;
  salarioEnLetras: string;
  formaYPeriodoPago: string;
  nombreEmpresaPago: string;
  direccionLugarPago: string;
  obligacionesYFuncionesCargo: string;
  listaHerramientasYMateriales: string;
  incentivosAdicionales: string;

  // Dependientes
  dependientes: Dependiente[];

  // Firma
  distritoFirma: string;
  fechaFirmaEnLetras: string;

  // Confidencialidad
  direccionInstalacionesEmpresa: string;
  ciudadJurisdiccionTribunales: string;

  // Constancia de Salario
  fechaIngreso: string;
  sueldoBase: string;
  deduccionIsss: string;
  deduccionAfp: string;
  deduccionIsr: string;
  deduccionOtros: string;
  totalDeducciones: string;
  otrosIngresos: string;
  totalIngresos: string;
  liquidoAPagar: string;
  nombreRepresentanteRrhh: string;
  cargoRepresentanteRrhh: string;
  destinatarioInstitucionOPersona: string;
  ciudadEmision: string;
  fechaEmisionEnLetras: string;

  // Metadatos
  employeeName: string;
  branch: string;
  contractType: string;
  startDate: string;
  endDate?: string;
  salary: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
};
