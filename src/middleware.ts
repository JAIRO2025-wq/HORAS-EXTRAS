
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/request';

/**
 * MIDDLEWARE DE SEGURIDAD GLOBAL
 * Centraliza la protección de rutas tanto de UI como de API.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Definir rutas públicas (que no requieren sesión)
  const isPublicRoute = 
    pathname === '/' || 
    pathname === '/admin/login' || 
    pathname.startsWith('/api/auth/') || 
    pathname.startsWith('/api/admin/login') ||
    pathname.startsWith('/api/push/keys') ||
    pathname === '/api/employees' || // Necesario para compatibilidad
    pathname === '/api/branches' ||  // Necesario para compatibilidad
    pathname === '/api/admin/admins'; // Necesario para compatibilidad

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // 2. Obtener sesiones desde cookies HttpOnly
  const adminSession = request.cookies.get('admin_session')?.value;
  const employeeSession = request.cookies.get('employee_session')?.value;

  // 3. Protección de Rutas de Administración (/admin y /api/admin)
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (!adminSession) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Acceso Administrativo Denegado' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // 4. Protección de Rutas de Usuario/Dashboard
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/')) {
    // Si no hay ninguna sesión activa (ni admin ni empleado)
    if (!adminSession && !employeeSession) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Sesión Requerida' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Aplicar a todas las rutas excepto recursos estáticos
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|reloj.ico|icons/).*)'],
};
