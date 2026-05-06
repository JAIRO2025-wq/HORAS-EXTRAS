import { NextResponse } from 'next/server';
import { identifyPayStub } from '@/ai/flows/identify-paystub-flow';
import fs from 'fs/promises';
import path from 'path';
import type { Employee } from '@/lib/types';

const dataDir = path.join(process.cwd(), 'data');

export async function POST(request: Request) {
  try {
    const { fileDataUri, fileName } = await request.json();

    if (!fileDataUri) {
      return NextResponse.json({ error: 'File data is required' }, { status: 400 });
    }

    // 1. Ask AI to identify the name in the stub
    const aiResult = await identifyPayStub({ fileDataUri });

    // 2. Load our active employees
    const employeesPath = path.join(dataDir, 'employees.json');
    const employeesContent = await fs.readFile(employeesPath, 'utf-8');
    const employees: Employee[] = JSON.parse(employeesContent).filter((e: Employee) => e.status === 'active');

    // 3. Try to find a match in our system
    // We'll use simple inclusion logic for better resilience against minor AI typos
    const normalizedAIName = aiResult.employeeName.toLowerCase().trim();
    
    const matchedEmployee = employees.find(emp => {
        const empName = emp.name.toLowerCase().trim();
        return empName.includes(normalizedAIName) || normalizedAIName.includes(empName);
    });

    return NextResponse.json({
      fileName,
      extractedName: aiResult.employeeName,
      matchedEmployee: matchedEmployee ? { id: matchedEmployee.id, name: matchedEmployee.name } : null,
      confidence: aiResult.confidence,
      isPayStub: aiResult.isPayStub
    });

  } catch (error) {
    console.error('Error processing stub:', error);
    return NextResponse.json({ error: 'Failed to identify stub' }, { status: 500 });
  }
}
