
import { NextResponse } from 'next/server';
import { SecurityManager } from '@/lib/security';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session')?.value;
  
  if (token) {
    SecurityManager.revokeSession(token);
  }

  const response = NextResponse.json({ success: true });
  
  response.cookies.set('admin_session', '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });

  return response;
}
