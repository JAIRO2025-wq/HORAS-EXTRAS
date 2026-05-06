import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const logFilePath = path.join(dataDir, 'events.log');

type LogEventPayload = {
  eventType: string;
  message: string;
};

export async function POST(request: Request) {
  try {
    const body: LogEventPayload = await request.json();

    if (!body.eventType || !body.message) {
      return NextResponse.json(
        { error: 'eventType and message are required' },
        { status: 400 }
      );
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      ...body,
    };

    // Ensure the data directory exists
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }

    // Append the event to the log file as a new line
    await fs.appendFile(logFilePath, JSON.stringify(logEntry) + '\n', 'utf-8');

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Failed to write to event log:', error);
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
