import { randomInt } from 'crypto';

/**
 * FASE 2 - Almacén de OTP en memoria.
 * Códigos de 6 dígitos con expiración de 5 minutos.
 */

type OtpEntry = {
  code: string;
  expiresAt: number;
};

const globalForOtp = global as unknown as { otpStore?: Map<string, OtpEntry> };
const otpStore = globalForOtp.otpStore || new Map<string, OtpEntry>();

if (process.env.NODE_ENV !== 'production') {
  globalForOtp.otpStore = otpStore;
}

const OTP_TTL_MS = 5 * 60 * 1000;

export function generateOtp(key: string): string {
  const code = randomInt(0, 1000000).toString().padStart(6, '0');
  otpStore.set(key, { code, expiresAt: Date.now() + OTP_TTL_MS });
  return code;
}

export function validateOtp(key: string, code: string): boolean {
  const entry = otpStore.get(key);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    otpStore.delete(key);
    return false;
  }
  if (entry.code !== code) return false;

  // Uso único: se consume al validar correctamente.
  otpStore.delete(key);
  return true;
}

export function hasValidOtp(key: string): boolean {
  const entry = otpStore.get(key);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    otpStore.delete(key);
    return false;
  }
  return true;
}
