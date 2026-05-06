
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const adminsFilePath = path.join(dataDir, 'admins.json');

async function readAdminsFile(): Promise<any[]> {
  try {
    const fileContent = await fs.readFile(adminsFilePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    const initialAdmins = [
      { id: '1', name: 'Admin Control', pin: '2026', role: 'ADMIN_1' },
      { id: '2', name: 'Admin Gerencia', pin: '7777', role: 'ADMIN_2' }
    ];
    await fs.writeFile(adminsFilePath, JSON.stringify(initialAdmins, null, 2));
    return initialAdmins;
  }
}

export async function GET() {
  try {
    const admins = await readAdminsFile();
    // CRÍTICO: Eliminar los PINs antes de enviar la lista al frontend
    const safeAdmins = admins.map(({ pin, ...rest }) => rest);
    return NextResponse.json(safeAdmins);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, pin, role } = await request.json();
    const admins = await readAdminsFile();
    const newAdmin = { id: crypto.randomUUID(), name: name.trim(), pin: pin.trim(), role: role || 'ADMIN_1' };
    admins.push(newAdmin);
    await fs.writeFile(adminsFilePath, JSON.stringify(admins, null, 2));
    return NextResponse.json({ id: newAdmin.id, name: newAdmin.name, role: newAdmin.role }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, name, pin, role } = await request.json();
    const admins = await readAdminsFile();
    const idx = admins.findIndex(a => a.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (name) admins[idx].name = name.trim();
    if (pin) admins[idx].pin = pin.trim();
    if (role) admins[idx].role = role;
    await fs.writeFile(adminsFilePath, JSON.stringify(admins, null, 2));
    return NextResponse.json({ id: admins[idx].id, name: admins[idx].name, role: admins[idx].role });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    let admins = await readAdminsFile();
    if (admins.length <= 1) return NextResponse.json({ error: 'Mínimo un admin' }, { status: 400 });
    admins = admins.filter(a => a.id !== id);
    await fs.writeFile(adminsFilePath, JSON.stringify(admins, null, 2));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
