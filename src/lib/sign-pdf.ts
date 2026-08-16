import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { SUBFILTER_ETSI_CADES_DETACHED } from '@signpdf/utils';
import { plainAddPlaceholder } from './plain-placeholder';
import { ensureCompanyPfx, ensurePfxWithChain } from './pki';
import type { EnrollmentRecord } from './signatures';

type SignatureMeta = {
  name: string;
  reason: string;
  location: string;
  contactInfo: string;
};

/** Nombre legal completo de la empresa emisora. */
export const COMPANY_NAME = 'FLYNET BUSSINES AND SYSTEM SA DE CV';

/**
 * Áreas de la firma del empleado dentro del comprobante de pago.
 * El comprobante imprime 2 copias por página (superior e inferior), cada una
 * con su línea "F. ____" / "EMPLEADO". `lineY` es la línea base del guión de
 * firma; todos los elementos se dibujan POR ENCIMA de esa línea.
 * Las coordenadas Y se miden desde la base inferior de la página (carta 612x792).
 */
const EMPLOYEE_SIGNATURE_AREAS = [
  { x: 372, lineY: 448 },
  { x: 372, lineY: 98 },
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatSignDate(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * FASE 3 - Marca visual de la firma del empleado (NO en la firma de la empresa).
 * Dibuja POR ENCIMA de la línea de firma del empleado, bien pegada a ella:
 * un recuadro tipo sello con QR (información de la firma de la empresa) y el
 * bloque "Firmado electrónicamente por: <nombre> / empresa / fecha PAdES".
 * Se aplica ANTES de la Firma 1 (Empresa), para no invalidar la firma digital
 * incremental posterior.
 */
async function drawEmployeeSignatureText(pdfBuffer: Buffer, employeeName: string): Promise<Buffer> {
  const now = new Date();
  const doc = await PDFDocument.load(pdfBuffer);
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const labelColor = rgb(0.18, 0.34, 0.56);
  const nameColor = rgb(0.1, 0.2, 0.4);
  const mutedColor = rgb(0.42, 0.48, 0.56);
  const borderColor = rgb(0.35, 0.5, 0.75);

  // QR: información de la firma de la empresa (verificable escaneándolo).
  const qrText = [
    COMPANY_NAME,
    'Firma digital de Recibo de Pago (PAdES)',
    `Empleado: ${employeeName}`,
    `Fecha: ${formatSignDate(now)}`,
  ].join('\n');
  const qrPng = await QRCode.toBuffer(qrText, {
    type: 'png',
    width: 320,
    errorCorrectionLevel: 'M',
    margin: 1,
  });
  const qrImage = await doc.embedPng(qrPng);

  const labelText = 'Firmado electrónicamente por:';
  const dateLine = `Firma PAdES valida · ${formatSignDate(now)}`;

  const labelSize = 7;
  const nameSize = 8.5;
  const companySize = 6.5;
  const dateSize = 6;
  const QR_SIZE = 34;

  for (const page of doc.getPages()) {
    for (const area of EMPLOYEE_SIGNATURE_AREAS) {
      const { x, lineY } = area;

      // Ancho del bloque según el texto más largo (evita el desborde).
      const textWidth = Math.max(
        helvetica.widthOfTextAtSize(labelText, labelSize),
        helveticaBold.widthOfTextAtSize(employeeName, nameSize),
        helvetica.widthOfTextAtSize(COMPANY_NAME, companySize),
        helvetica.widthOfTextAtSize(dateLine, dateSize)
      );

      const textX = x + QR_SIZE + 10;
      const boxLeft = x - 8;
      const boxRight = textX + textWidth + 10;
      const boxBottom = lineY + 7; // apenas sobre la línea de guiones
      const boxTop = lineY + 47;

      // Recuadro tipo sello (fondo transparente, solo borde).
      page.drawRectangle({
        x: boxLeft,
        y: boxBottom,
        width: boxRight - boxLeft,
        height: boxTop - boxBottom,
        borderColor,
        borderWidth: 0.8,
      });

      page.drawImage(qrImage, {
        x,
        y: lineY + 9,
        width: QR_SIZE,
        height: QR_SIZE,
      });

      page.drawText(labelText, {
        x: textX,
        y: lineY + 37,
        size: labelSize,
        font: helvetica,
        color: labelColor,
      });
      page.drawText(employeeName, {
        x: textX,
        y: lineY + 26,
        size: nameSize,
        font: helveticaBold,
        color: nameColor,
      });
      page.drawText(COMPANY_NAME, {
        x: textX,
        y: lineY + 16,
        size: companySize,
        font: helvetica,
        color: mutedColor,
      });
      page.drawText(dateLine, {
        x: textX,
        y: lineY + 9,
        size: dateSize,
        font: helvetica,
        color: mutedColor,
      });
    }
  }

  const bytes = await doc.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}

/**
 * `@signpdf/placeholder-plain` sólo soporta la tabla xref clásica (PDF 1.4).
 * `pdf-lib` escribe por defecto un xref como stream; al guardar con
 * `useObjectStreams: false` produce la tabla xref clásica que @signpdf necesita.
 * Se normaliza únicamente la Firma 1 (Empresa), antes de aplicar la primera firma.
 */
async function normalizeToClassicXref(pdfBuffer: Buffer): Promise<Buffer> {
  const doc = await PDFDocument.load(pdfBuffer);
  const bytes = await doc.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}

async function applySignature(
  pdfBuffer: Buffer,
  pfxBuffer: Buffer,
  passphrase: string,
  meta: SignatureMeta
): Promise<Buffer> {
  const pdfWithPlaceholder = plainAddPlaceholder({
    pdfBuffer,
    reason: meta.reason,
    contactInfo: meta.contactInfo,
    name: meta.name,
    location: meta.location,
    subFilter: SUBFILTER_ETSI_CADES_DETACHED,
  });

  const signer = new P12Signer(pfxBuffer, { passphrase });
  return new SignPdf().sign(pdfWithPlaceholder, signer);
}

/**
 * FASE 3 - Firma 1 (Empresa). Se aplica al guardar el recibo.
 * Normaliza el PDF plano a xref clásico, dibuja la marca visual de la firma
 * del empleado (texto + QR) y luego firma con el certificado de la empresa.
 */
export async function signCompanyPdf(pdfBuffer: Buffer, employeeName: string): Promise<Buffer> {
  const { pfxBuffer, passphrase } = await ensureCompanyPfx();
  const normalized = await normalizeToClassicXref(pdfBuffer);
  const withVisualSignature = await drawEmployeeSignatureText(normalized, employeeName);
  return applySignature(withVisualSignature, pfxBuffer, passphrase, {
    name: COMPANY_NAME,
    reason: 'Firma de la Empresa - Emisor del recibo de pago',
    location: 'El Salvador',
    contactInfo: 'rrhh@flynet.com',
  });
}

/**
 * FASE 3 - Firma 2 (Empleado). Requiere el .pfx desbloqueado con su PIN.
 * Se aplica como actualización incremental sobre el PDF ya firmado por la Empresa,
 * de modo que la Firma 1 permanece válida.
 */
export async function signEmployeePdf(
  pdfBuffer: Buffer,
  enrollment: EnrollmentRecord,
  pin: string,
  meta: { ip: string; otpCode: string }
): Promise<Buffer> {
  // Re-emite el .pfx con la CA en la cadena si el enrolamiento es anterior al fix.
  const pfxBuffer = await ensurePfxWithChain(enrollment.pfxBase64, pin);

  return applySignature(pdfBuffer, pfxBuffer, pin, {
    name: enrollment.name,
    reason: 'Firma del Empleado - Aceptación del recibo de pago',
    location: `IP: ${meta.ip} | Fecha: ${new Date().toISOString()} | OTP: ${meta.otpCode}`,
    contactInfo: enrollment.email,
  });
}
