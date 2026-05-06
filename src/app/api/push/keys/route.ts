
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import webpush from 'web-push';

const dataDir = path.join(process.cwd(), 'data');
const keysFilePath = path.join(dataDir, 'vapid.json');

export async function GET() {
  try {
    let keys;
    try {
      const content = await fs.readFile(keysFilePath, 'utf-8');
      keys = JSON.parse(content);
    } catch (e) {
      // Si no existen las llaves, las generamos por primera vez
      keys = webpush.generateVAPIDKeys();
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(keysFilePath, JSON.stringify(keys), 'utf-8');
    }

    return NextResponse.json({ publicKey: keys.publicKey });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to manage push keys' }, { status: 500 });
  }
}
