export type Employee = {
  id: number;
  name: string;
  status: 'active' | 'inactive';
  salary: number;
  pin?: string;
  branch: string;
  position?: string;
  isSupervisor?: boolean;
};

export type Branch = {
  id: number;
  name: string;
  deviceId?: string | null;
  isUnrestricted?: boolean;
  isAttendanceEnabled?: boolean;
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
