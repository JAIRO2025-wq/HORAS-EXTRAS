import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { ContractRecord } from '@/lib/types';

const dataDir = path.join(process.cwd(), 'data');
const contractsFilePath = path.join(dataDir, 'contracts.json');

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user = searchParams.get('user');

    let contracts: ContractRecord[] = [];
    try {
      const content = await fs.readFile(contractsFilePath, 'utf-8');
      if (content.trim()) contracts = JSON.parse(content);
    } catch {
      return NextResponse.json([]);
    }

    if (user) {
      contracts = contracts.filter(
        (c) => c.employeeName.toLowerCase() === user.toLowerCase()
      );
    }

    return NextResponse.json(contracts);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
