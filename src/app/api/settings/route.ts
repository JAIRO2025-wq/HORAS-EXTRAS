import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getDaysInMonth } from 'date-fns';
import { months } from '@/lib/data';

const dataDir = path.join(process.cwd(), 'data');
const settingsFilePath = path.join(dataDir, 'settings.json');

type MonthlySettings = {
  quincena1_active: boolean;
  quincena2_active: boolean;
  quincena1_cutoff: number;
  quincena2_cutoff: number;
};

type AllSettings = {
  [month: string]: MonthlySettings;
};

async function ensureDataDirExists() {
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

function getDefaultSettings(month: string): MonthlySettings {
    const monthIndex = months.indexOf(month);
    // This logic assumes the current year for calculating days in a month.
    // This is acceptable as there is no year selector in the app.
    const year = new Date().getFullYear();
    const lastDay = getDaysInMonth(new Date(year, monthIndex));

    return {
        quincena1_active: true,
        quincena2_active: true,
        quincena1_cutoff: 15,
        quincena2_cutoff: lastDay,
    };
}


async function readSettingsFile(): Promise<AllSettings> {
    await ensureDataDirExists();
    try {
        const fileContent = await fs.readFile(settingsFilePath, 'utf-8');
        if (fileContent.trim() === '') return {};
        return JSON.parse(fileContent);
    } catch (error) {
        if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
            await writeSettingsFile({});
            return {};
        }
        console.error('Failed to read settings file:', error);
        throw new Error('Failed to read settings');
    }
}

async function writeSettingsFile(data: AllSettings): Promise<void> {
    await ensureDataDirExists();
    try {
        await fs.writeFile(settingsFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error('Failed to write settings file:', error);
        throw new Error('Failed to save settings');
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    if (!month || !months.includes(month)) {
        return NextResponse.json({ error: 'Valid month is required' }, { status: 400 });
    }

    try {
        const allSettings = await readSettingsFile();
        let monthSettings = allSettings[month];

        if (!monthSettings) {
            monthSettings = getDefaultSettings(month);
            allSettings[month] = monthSettings;
            await writeSettingsFile(allSettings);
        }

        return NextResponse.json(monthSettings);

    } catch (error) {
         return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    if (!month || !months.includes(month)) {
        return NextResponse.json({ error: 'Valid month is required' }, { status: 400 });
    }

    try {
        const newMonthSettings: MonthlySettings = await request.json();
        
        if (
          typeof newMonthSettings.quincena1_active !== 'boolean' ||
          typeof newMonthSettings.quincena2_active !== 'boolean' ||
          typeof newMonthSettings.quincena1_cutoff !== 'number' ||
          typeof newMonthSettings.quincena2_cutoff !== 'number'
        ) {
          return NextResponse.json(
            { error: 'Invalid settings format' },
            { status: 400 }
          );
        }

        const allSettings = await readSettingsFile();
        allSettings[month] = newMonthSettings;
        await writeSettingsFile(allSettings);
        
        return NextResponse.json(newMonthSettings, { status: 200 });

    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
