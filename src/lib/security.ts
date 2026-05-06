
import { randomBytes } from 'crypto';

/**
 * STORE DE SESIONES SEGURO (Server-side)
 * Evita que el nombre del usuario viaje en la cookie.
 */
type Session = {
  name: string;
  role: 'employee' | 'admin';
  expiresAt: number;
};

// Uso de global para persistencia en desarrollo (Hot Reload)
const globalForSecurity = global as unknown as { 
  sessions: Map<string, Session>;
  loginAttempts: Map<string, { count: number; lastAttempt: number }>;
};

const sessions = globalForSecurity.sessions || new Map<string, Session>();
const loginAttempts = globalForSecurity.loginAttempts || new Map<string, { count: number; lastAttempt: number }>();

if (process.env.NODE_ENV !== 'production') {
  globalForSecurity.sessions = sessions;
  globalForSecurity.loginAttempts = loginAttempts;
}

export const SecurityManager = {
  // --- GESTIÓN DE SESIONES ---
  createSession: (name: string, role: 'employee' | 'admin'): string => {
    const token = randomBytes(32).toString('hex');
    sessions.set(token, {
      name,
      role,
      expiresAt: Date.now() + 12 * 60 * 60 * 1000 // 12 horas
    });
    return token;
  },

  getSession: (token: string): Session | null => {
    const session = sessions.get(token);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      sessions.delete(token);
      return null;
    }
    return session;
  },

  revokeSession: (token: string) => {
    sessions.delete(token);
  },

  // --- RATE LIMITING ---
  checkRateLimit: (ip: string): { allowed: boolean; remainingMinutes: number } => {
    const attempts = loginAttempts.get(ip);
    const windowMs = 15 * 60 * 1000; // 15 minutos

    if (attempts && attempts.count >= 5) {
      const timePassed = Date.now() - attempts.lastAttempt;
      if (timePassed < windowMs) {
        return { 
          allowed: false, 
          remainingMinutes: Math.ceil((windowMs - timePassed) / 60000) 
        };
      } else {
        loginAttempts.delete(ip); // Reset después del tiempo de espera
      }
    }
    return { allowed: true, remainingMinutes: 0 };
  },

  registerFailure: (ip: string) => {
    const current = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    loginAttempts.set(ip, { 
      count: current.count + 1, 
      lastAttempt: Date.now() 
    });
  },

  resetAttempts: (ip: string) => {
    loginAttempts.delete(ip);
  }
};
