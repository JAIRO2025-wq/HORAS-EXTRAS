
import { cookies } from 'next/headers';
import { SecurityManager } from './security';

/**
 * UTILIDAD CENTRALIZADA DE AUTENTICACIÓN
 * Valida tokens opacos contra el store del servidor.
 */
export async function getAuthContext() {
  const cookieStore = await cookies();
  
  // Intentar admin primero
  const adminToken = cookieStore.get('admin_session')?.value;
  if (adminToken) {
    const session = SecurityManager.getSession(adminToken);
    if (session && session.role === 'admin') {
      return { role: 'admin', name: session.name, token: adminToken };
    }
  }

  // Intentar empleado
  const employeeToken = cookieStore.get('employee_session')?.value;
  if (employeeToken) {
    const session = SecurityManager.getSession(employeeToken);
    if (session && session.role === 'employee') {
      return { role: 'employee', name: session.name, token: employeeToken };
    }
  }

  return null;
}
