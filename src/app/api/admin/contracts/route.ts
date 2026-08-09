import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { ContractRecord, Employee } from '@/lib/types';

const dataDir = path.join(process.cwd(), 'data');
const contractsFilePath = path.join(dataDir, 'contracts.json');
const employeesFilePath = path.join(dataDir, 'employees.json');

async function ensureDataDir() {
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

async function readEmployees(): Promise<Employee[]> {
  await ensureDataDir();
  try {
    const content = await fs.readFile(employeesFilePath, 'utf-8');
    if (content.trim() === '') return [];
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeEmployees(data: Employee[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(employeesFilePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Sincroniza datos personales del empleado desde el contrato.
 * Solo llena campos que el empleado NO tiene todavía.
 */
async function syncEmployeeFromContract(contract: ContractRecord) {
  const employees = await readEmployees();
  const empIndex = employees.findIndex((e) => e.id === contract.employeeId);
  if (empIndex === -1) return;

  const emp = employees[empIndex];
  let updated = false;

  const fieldMap: Array<{ contractField: keyof ContractRecord; employeeField: keyof Employee }> = [
    { contractField: 'duiEmpleado', employeeField: 'dui' },
    { contractField: 'nitEmpleado', employeeField: 'nit' },
    { contractField: 'edadEmpleado', employeeField: 'edad' },
    { contractField: 'sexoEmpleado', employeeField: 'sexo' },
    { contractField: 'nacionalidadEmpleado', employeeField: 'nacionalidad' },
    { contractField: 'estadoFamiliarEmpleado', employeeField: 'estadoFamiliar' },
    { contractField: 'profesionEmpleado', employeeField: 'profesion' },
    { contractField: 'domicilioEmpleado', employeeField: 'domicilio' },
    { contractField: 'residenciaEmpleado', employeeField: 'residencia' },
    { contractField: 'lugarExpedicionDuiEmpleado', employeeField: 'lugarExpedicionDui' },
    { contractField: 'fechaExpedicionDuiEmpleado', employeeField: 'fechaExpedicionDui' },
    { contractField: 'cargoPuesto', employeeField: 'position' },
    { contractField: 'salarioEnNumeros', employeeField: 'salary' },
  ];

  for (const { contractField, employeeField } of fieldMap) {
    const contractValue = contract[contractField];
    const empValue = (emp as any)[employeeField];

    // Solo actualizar si el contrato tiene dato y el empleado NO lo tiene (o está vacío)
    // Excepción: salario en números — parsear
    if (employeeField === 'salary' && contract.salarioEnNumeros) {
      const salarioNum = parseFloat(contract.salarioEnNumeros.replace(/[^0-9.]/g, ''));
      if (!isNaN(salarioNum) && !emp.salary) {
        (emp as any).salary = salarioNum;
        updated = true;
      }
      continue;
    }

    if (contractValue && contractValue !== '' && (!empValue || empValue === '')) {
      (emp as any)[employeeField] = contractValue;
      updated = true;
    }
  }

  if (updated) {
    // También actualizar el nombre si no está
    if (!emp.name && contract.nombreEmpleado) {
      emp.name = contract.nombreEmpleado;
    }
    employees[empIndex] = emp;
    await writeEmployees(employees);
  }
}

async function readContracts(): Promise<ContractRecord[]> {
  await ensureDataDir();
  try {
    const content = await fs.readFile(contractsFilePath, 'utf-8');
    if (content.trim() === '') return [];
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeContracts(data: ContractRecord[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(contractsFilePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function GET() {
  try {
    const contracts = await readContracts();
    return NextResponse.json(contracts);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const contracts = await readContracts();
    const id = `CTR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const newContract: ContractRecord = {
      id,
      employeeId: body.employeeId || 0,
      status: 'pendiente',

      // Empresa
      razonSocialEmpresa: body.razonSocialEmpresa || '',
      abreviaturaEmpresa: body.abreviaturaEmpresa || '',

      // Empleador
      nombreEmpleador: body.nombreEmpleador || '',
      duiEmpleador: body.duiEmpleador || '',
      nitEmpleador: body.nitEmpleador || '',
      edadEmpleador: body.edadEmpleador || '',
      sexoEmpleador: body.sexoEmpleador || '',
      nacionalidadEmpleador: body.nacionalidadEmpleador || '',
      estadoFamiliarEmpleador: body.estadoFamiliarEmpleador || '',
      profesionEmpleador: body.profesionEmpleador || '',
      domicilioEmpleador: body.domicilioEmpleador || '',
      lugarExpedicionDuiEmpleador: body.lugarExpedicionDuiEmpleador || '',
      fechaExpedicionDuiEmpleador: body.fechaExpedicionDuiEmpleador || '',

      // Empleado
      nombreEmpleado: body.nombreEmpleado || '',
      duiEmpleado: body.duiEmpleado || '',
      nitEmpleado: body.nitEmpleado || '',
      edadEmpleado: body.edadEmpleado || '',
      sexoEmpleado: body.sexoEmpleado || '',
      nacionalidadEmpleado: body.nacionalidadEmpleado || '',
      estadoFamiliarEmpleado: body.estadoFamiliarEmpleado || '',
      profesionEmpleado: body.profesionEmpleado || '',
      domicilioEmpleado: body.domicilioEmpleado || '',
      residenciaEmpleado: body.residenciaEmpleado || '',
      lugarExpedicionDuiEmpleado: body.lugarExpedicionDuiEmpleado || '',
      fechaExpedicionDuiEmpleado: body.fechaExpedicionDuiEmpleado || '',

      // Contrato
      cargoPuesto: body.cargoPuesto || '',
      representanteLegalEmpresa: body.representanteLegalEmpresa || body.nombreEmpleador || '',
      tipoDuracionContrato: body.tipoDuracionContrato || '',
      periodoContrato: body.periodoContrato || '',
      fechaInicioServicio: body.fechaInicioServicio || body.startDate || '',
      lugarPrestacionServicios: body.lugarPrestacionServicios || '',
      direccionPrestacionServicios: body.direccionPrestacionServicios || '',
      horasSemanaLaboral: body.horasSemanaLaboral || '',
      horarioDeTrabajo: body.horarioDeTrabajo || '',
      salarioEnNumeros: body.salarioEnNumeros || (body.salary ? `$${Number(body.salary).toFixed(2)}` : ''),
      salarioEnLetras: body.salarioEnLetras || '',
      formaYPeriodoPago: body.formaYPeriodoPago || '',
      nombreEmpresaPago: body.nombreEmpresaPago || body.razonSocialEmpresa || '',
      direccionLugarPago: body.direccionLugarPago || '',
      obligacionesYFuncionesCargo: body.obligacionesYFuncionesCargo || '',
      listaHerramientasYMateriales: body.listaHerramientasYMateriales || '',
      incentivosAdicionales: body.incentivosAdicionales || '',

      dependientes: body.dependientes || [],

      distritoFirma: body.distritoFirma || '',
      fechaFirmaEnLetras: body.fechaFirmaEnLetras || '',

      // Confidencialidad
      direccionInstalacionesEmpresa: body.direccionInstalacionesEmpresa || '',
      ciudadJurisdiccionTribunales: body.ciudadJurisdiccionTribunales || '',

      // Constancia de Salario
      fechaIngreso: body.fechaIngreso || '',
      sueldoBase: body.sueldoBase || '',
      deduccionIsss: body.deduccionIsss || '',
      deduccionAfp: body.deduccionAfp || '',
      deduccionIsr: body.deduccionIsr || '',
      deduccionOtros: body.deduccionOtros || '',
      totalDeducciones: body.totalDeducciones || '',
      otrosIngresos: body.otrosIngresos || '',
      totalIngresos: body.totalIngresos || '',
      liquidoAPagar: body.liquidoAPagar || '',
      nombreRepresentanteRrhh: body.nombreRepresentanteRrhh || '',
      cargoRepresentanteRrhh: body.cargoRepresentanteRrhh || '',
      destinatarioInstitucionOPersona: body.destinatarioInstitucionOPersona || '',
      ciudadEmision: body.ciudadEmision || '',
      fechaEmisionEnLetras: body.fechaEmisionEnLetras || '',

      // Metadatos
      employeeName: body.employeeName || body.nombreEmpleado || '',
      branch: body.branch || '',
      contractType: body.contractType || '',
      startDate: body.startDate || '',
      endDate: body.endDate || undefined,
      salary: Number(body.salary) || 0,
      notes: body.notes || undefined,
      createdAt: new Date().toISOString(),
    };

    contracts.push(newContract);
    await writeContracts(contracts);

    // Sincronizar datos del empleado
    syncEmployeeFromContract(newContract);

    return NextResponse.json(newContract, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const contracts = await readContracts();
    const index = contracts.findIndex((c) => c.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    const allowedFields = [
      'status', 'notes',
      'contractGeneratedUrl', 'contractSignedUrl',
      'confidentialityGeneratedUrl', 'confidentialitySignedUrl',
      'salaryCertificateUrl',
      // Campos editables del contrato
      'razonSocialEmpresa', 'abreviaturaEmpresa',
      'nombreEmpleador', 'duiEmpleador', 'nitEmpleador', 'edadEmpleador', 'sexoEmpleador',
      'nacionalidadEmpleador', 'estadoFamiliarEmpleador', 'profesionEmpleador', 'domicilioEmpleador',
      'lugarExpedicionDuiEmpleador', 'fechaExpedicionDuiEmpleador',
      'nombreEmpleado', 'duiEmpleado', 'nitEmpleado', 'edadEmpleado', 'sexoEmpleado',
      'nacionalidadEmpleado', 'estadoFamiliarEmpleado', 'profesionEmpleado', 'domicilioEmpleado',
      'residenciaEmpleado', 'lugarExpedicionDuiEmpleado', 'fechaExpedicionDuiEmpleado',
      'cargoPuesto', 'representanteLegalEmpresa', 'tipoDuracionContrato', 'periodoContrato',
      'fechaInicioServicio', 'lugarPrestacionServicios', 'direccionPrestacionServicios',
      'horasSemanaLaboral', 'horarioDeTrabajo', 'salarioEnNumeros', 'salarioEnLetras',
      'formaYPeriodoPago', 'nombreEmpresaPago', 'direccionLugarPago',
      'obligacionesYFuncionesCargo', 'listaHerramientasYMateriales', 'incentivosAdicionales',
      'dependientes', 'distritoFirma', 'fechaFirmaEnLetras',
      'direccionInstalacionesEmpresa', 'ciudadJurisdiccionTribunales',
      'fechaIngreso', 'sueldoBase', 'deduccionIsss', 'deduccionAfp', 'deduccionIsr',
      'deduccionOtros', 'totalDeducciones', 'otrosIngresos', 'totalIngresos',
      'liquidoAPagar', 'nombreRepresentanteRrhh', 'cargoRepresentanteRrhh',
      'destinatarioInstitucionOPersona', 'ciudadEmision', 'fechaEmisionEnLetras',
      'employeeName', 'branch', 'contractType', 'startDate', 'endDate', 'salary',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        (contracts[index] as any)[field] = body[field];
      }
    }

    contracts[index].updatedAt = new Date().toISOString();
    await writeContracts(contracts);

    // Sincronizar datos del empleado
    syncEmployeeFromContract(contracts[index]);

    return NextResponse.json(contracts[index], { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const contracts = await readContracts();
    const index = contracts.findIndex((c) => c.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    const contract = contracts[index];
    const filesToDelete = [
      contract.contractGeneratedUrl,
      contract.contractSignedUrl,
      contract.confidentialityGeneratedUrl,
      contract.confidentialitySignedUrl,
      contract.salaryCertificateUrl,
    ].filter(Boolean);

    for (const filePath of filesToDelete) {
      try {
        const fullPath = path.join(process.cwd(), 'public', filePath!);
        await fs.unlink(fullPath);
      } catch { /* archivo no existe */ }
    }

    contracts.splice(index, 1);
    await writeContracts(contracts);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
