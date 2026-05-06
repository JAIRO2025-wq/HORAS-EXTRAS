
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { cookies } from 'next/headers';
import type { Employee } from '@/lib/types';

const dataDir = path.join(process.cwd(), 'data');
const employeesFilePath = path.join(dataDir, 'employees.json');
const counterFilePath = path.join(dataDir, 'employee_counter.json');
const logFilePath = path.join(dataDir, 'events.log');

async function logToBackend(eventType: string, message: string) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      eventType,
      message,
    };
    await fs.appendFile(logFilePath, JSON.stringify(logEntry) + '\n', 'utf-8');
  } catch (e) {
    console.error('Failed to log mutation:', e);
  }
}

async function getNextEmployeeId(): Promise<number> {
    try {
        const content = await fs.readFile(counterFilePath, 'utf-8');
        const data = JSON.parse(content);
        const nextId = data.lastId + 1;
        await fs.writeFile(counterFilePath, JSON.stringify({ lastId: nextId }));
        return nextId;
    } catch (error) {
        let initialId = 0;
        try {
            const employees = await readEmployeesFile();
            if (employees.length > 0) {
                initialId = Math.max(...employees.map(e => e.id));
            }
        } catch (e) {}
        
        const nextId = initialId + 1;
        await fs.writeFile(counterFilePath, JSON.stringify({ lastId: nextId }));
        return nextId;
    }
}

async function readEmployeesFile(): Promise<Employee[]> {
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }

  try {
    const fileContent = await fs.readFile(employeesFilePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw new Error('Failed to read employees data');
  }
}

async function writeEmployeesFile(data: Employee[]): Promise<void> {
  await fs.writeFile(employeesFilePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const isAdmin = cookieStore.get('admin_session')?.value;
        const employees = await readEmployeesFile();
        
        // Si no es admin, filtramos los PINs para proteger la privacidad
        if (!isAdmin) {
            return NextResponse.json(employees.map(({ pin, ...rest }) => rest));
        }

        return NextResponse.json(employees);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, salary, branch, isSupervisor } = body;

        if (!name || !salary || !branch) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const employees = await readEmployeesFile();
        const nextId = await getNextEmployeeId();
        
        const newEmployee: Employee = {
            id: nextId,
            name: name.trim().toUpperCase(),
            status: 'active',
            salary: salary,
            pin: Math.floor(100000 + Math.random() * 900000).toString(),
            branch: branch.trim(),
            isSupervisor: !!isSupervisor
        };

        employees.push(newEmployee);
        await writeEmployeesFile(employees);
        
        await logToBackend('employee_created', `NUEVO EMPLEADO: Se creó a '[${newEmployee.id}] ${newEmployee.name}' asignado a la sucursal '${newEmployee.branch}' con un salario de $${newEmployee.salary}. Jefe: ${newEmployee.isSupervisor ? 'SI' : 'NO'}.`);

        return NextResponse.json(newEmployee, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id } = body;

        const employees = await readEmployeesFile();
        const employeeIndex = employees.findIndex(e => e.id === id);

        if (employeeIndex === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        
        const oldData = { ...employees[employeeIndex] };
        
        if (body.name) employees[employeeIndex].name = body.name.trim().toUpperCase();
        if (body.salary !== undefined) employees[employeeIndex].salary = body.salary;
        if (body.status) employees[employeeIndex].status = body.status;
        if (body.pin) employees[employeeIndex].pin = body.pin;
        if (body.branch) employees[employeeIndex].branch = body.branch.trim();
        if (body.isSupervisor !== undefined) employees[employeeIndex].isSupervisor = body.isSupervisor;

        await writeEmployeesFile(employees);
        
        let changes = [];
        if (oldData.name !== employees[employeeIndex].name) changes.push(`Nombre a '${employees[employeeIndex].name}'`);
        if (oldData.salary !== employees[employeeIndex].salary) changes.push(`Salario a $${employees[employeeIndex].salary}`);
        if (oldData.status !== employees[employeeIndex].status) changes.push(`Estado a '${employees[employeeIndex].status}'`);
        if (oldData.branch !== employees[employeeIndex].branch) changes.push(`Sucursal a '${employees[employeeIndex].branch}'`);
        if (oldData.pin !== employees[employeeIndex].pin) changes.push(`PIN cambiado`);
        if (oldData.isSupervisor !== employees[employeeIndex].isSupervisor) changes.push(`Rango Jefe: ${employees[employeeIndex].isSupervisor ? 'Activado' : 'Desactivado'}`);

        const changeMsg = changes.length > 0 ? `Cambios: ${changes.join(', ')}.` : 'Sin cambios significativos.';
        await logToBackend('employee_updated', `EMPLEADO ACTUALIZADO: '[${employees[employeeIndex].id}] ${employees[employeeIndex].name}'. ${changeMsg}`);

        return NextResponse.json(employees[employeeIndex], { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
