import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { CompanyProfile, CompanyDefaults } from '@/lib/types';

const dataDir = path.join(process.cwd(), 'data');
const filePath = path.join(dataDir, 'company_profiles.json');

async function ensureDataDir() {
  try { await fs.access(dataDir); } catch { await fs.mkdir(dataDir, { recursive: true }); }
}

async function readProfiles(): Promise<CompanyProfile[]> {
  await ensureDataDir();
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    if (content.trim() === '') return [];
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeProfiles(data: CompanyProfile[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function getEmptyDefaults(): CompanyDefaults {
  return {
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
}

export async function GET() {
  try {
    const profiles = await readProfiles();
    return NextResponse.json(profiles);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, nombre, ...rest } = body;

    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: 'El nombre de la empresa es requerido' }, { status: 400 });
    }

    const profiles = await readProfiles();
    const defaults = getEmptyDefaults();
    const fields = Object.keys(defaults) as (keyof CompanyDefaults)[];

    if (id) {
      // Actualizar existente
      const index = profiles.findIndex((p) => p.id === id);
      if (index === -1) {
        return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
      }
      profiles[index].nombre = nombre.trim();
      for (const field of fields) {
        if (rest[field] !== undefined) {
          (profiles[index] as any)[field] = rest[field];
        }
      }
      await writeProfiles(profiles);
      return NextResponse.json(profiles[index]);
    } else {
      // Crear nuevo
      const newProfile: CompanyProfile = {
        id: `EMP-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        nombre: nombre.trim(),
        ...defaults,
      };
      for (const field of fields) {
        if (rest[field] !== undefined) {
          (newProfile as any)[field] = rest[field];
        }
      }
      profiles.push(newProfile);
      await writeProfiles(profiles);
      return NextResponse.json(newProfile, { status: 201 });
    }
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

    const profiles = await readProfiles();
    const index = profiles.findIndex((p) => p.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    profiles.splice(index, 1);
    await writeProfiles(profiles);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
