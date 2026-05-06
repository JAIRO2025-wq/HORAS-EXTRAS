import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const subsFilePath = path.join(dataDir, 'push_subscriptions.json');

export async function GET() {
  try {
    const content = await fs.readFile(subsFilePath, 'utf-8');
    const subscriptions = JSON.parse(content);
    return NextResponse.json(subscriptions);
  } catch (error) {
    return NextResponse.json({});
  }
}
