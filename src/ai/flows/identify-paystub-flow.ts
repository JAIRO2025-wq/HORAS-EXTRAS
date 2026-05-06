'use server';
/**
 * @fileOverview AI Flow to identify employee information from a pay stub document.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const IdentifyPayStubInputSchema = z.object({
  fileDataUri: z
    .string()
    .describe(
      "A base64 data URI of the pay stub file (PDF or Image). Format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type IdentifyPayStubInput = z.infer<typeof IdentifyPayStubInputSchema>;

const IdentifyPayStubOutputSchema = z.object({
  employeeName: z.string().describe('The full name of the employee found in the document.'),
  isPayStub: z.boolean().describe('Whether the document appears to be a valid pay stub.'),
  confidence: z.number().describe('Confidence level from 0 to 1.'),
  periodFound: z.string().optional().describe('The payment period or month found in the stub.'),
});
export type IdentifyPayStubOutput = z.infer<typeof IdentifyPayStubOutputSchema>;

export async function identifyPayStub(input: IdentifyPayStubInput): Promise<IdentifyPayStubOutput> {
  return identifyPayStubFlow(input);
}

const prompt = ai.definePrompt({
  name: 'identifyPayStubPrompt',
  input: { schema: IdentifyPayStubInputSchema },
  output: { schema: IdentifyPayStubOutputSchema },
  prompt: `You are an expert HR assistant. Your task is to analyze the provided payment receipt (pay stub) and extract the employee's name.

The receipts might be simple or poorly formatted. Look for labels like "NOMBRE", "EMPLEADO", "COLABORADOR", or just a full name usually located at the top or center.

Return the full name exactly as written in the document.

Document: {{media url=fileDataUri}}`,
});

const identifyPayStubFlow = ai.defineFlow(
  {
    name: 'identifyPayStubFlow',
    inputSchema: IdentifyPayStubInputSchema,
    outputSchema: IdentifyPayStubOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      return {
        employeeName: 'Unknown',
        isPayStub: false,
        confidence: 0,
      };
    }
    return output;
  }
);
