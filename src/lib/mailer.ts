import nodemailer from 'nodemailer';

/**
 * FASE 2 - Servicio de correo (Nodemailer + Gmail SMTP).
 *
 * Configuración esperada en variables de entorno:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 * Si no están configuradas, se usa Gmail por defecto y el OTP
 * se imprime en consola (solo para desarrollo).
 */

const configured =
  !!process.env.SMTP_HOST &&
  !!process.env.SMTP_USER &&
  !!process.env.SMTP_PASS;

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!configured) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

export async function sendReminderEmail(
  email: string,
  opts: { employeeName: string; year: string; month: string; quincena: string }
): Promise<{ delivered: boolean }> {
  const mailer = getTransporter();

  if (!mailer) {
    console.warn(`[Recordatorio] SMTP no configurado. Recordatorio para ${email} (${opts.employeeName})`);
    return { delivered: false };
  }

  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Tienes un recibo de pago pendiente de firma',
    text: `Hola ${opts.employeeName},\n\nTienes pendiente la firma electrónica de tu recibo de pago correspondiente a ${opts.month} ${opts.year}, ${opts.quincena === '1' ? '1ra quincena' : '2da quincena'}.\n\nIngresa a la plataforma para revisarlo y firmarlo.`,
    html: `<p>Hola <strong>${opts.employeeName}</strong>,</p><p>Tienes pendiente la firma electrónica de tu recibo de pago correspondiente a <strong>${opts.month} ${opts.year}</strong> (${opts.quincena === '1' ? '1ra quincena' : '2da quincena'}).</p><p>Ingresa a la plataforma para revisarlo y firmarlo.</p>`,
  });

  return { delivered: true };
}

export async function sendOtpEmail(email: string, code: string): Promise<{ delivered: boolean }> {
  const mailer = getTransporter();

  if (!mailer) {
    // Modo desarrollo sin credenciales: se imprime para no bloquear el flujo.
    console.warn(`[OTP] SMTP no configurado. Código para ${email}: ${code}`);
    return { delivered: false };
  }

  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Código de verificación para firmar tu recibo',
    text: `Tu código de verificación es: ${code}\n\nEste código expira en 5 minutos.`,
    html: `<p>Tu código de verificación es:</p><h2>${code}</h2><p>Este código expira en 5 minutos.</p>`,
  });

  return { delivered: true };
}
