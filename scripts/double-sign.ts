import fs from 'fs';
import { signEmployeePdf } from '../src/lib/sign-pdf';
import { getEnrollment } from '../src/lib/signatures';

async function main() {
  const enrollment = await getEnrollment('JAIRO ANTONIO HERNANDEZ GUEVARA');
  if (!enrollment) throw new Error('Sin enrolamiento');
  const src = fs.readFileSync('data/pay-stubs/2026/Agosto/Q1/JAIRO_ANTONIO_HERNANDEZ_GUEVARA.pdf');
  const out = await signEmployeePdf(src, enrollment, '111111', { ip: '::1', otpCode: 'TEST-OK' });
  fs.writeFileSync('scripts/_double_signed.pdf', out);
  console.log('OK bytes:', out.length);
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
