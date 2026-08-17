// Prueba real del envío de correo OTP usando la misma ruta de producción.
// Uso: npx tsx scripts/test-email.mjs destinatario@correo.com
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { sendOtpEmail } = await import('../src/lib/mailer');

const to = process.argv[2];
if (!to) {
  console.error('Pasa el correo destinatario: npx tsx scripts/test-email.mjs tu@correo.com');
  process.exit(1);
}

const res = await sendOtpEmail(to, '123456');
console.log(res.delivered ? `CORREO ENVIADO a ${to}` : `NO enviado (SMTP no configurado o falló) → ${to}`);
