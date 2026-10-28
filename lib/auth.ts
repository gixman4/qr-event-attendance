import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

const SESSION_COOKIE = 'qr_admin_session';
const SESSION_VALUE = 'authenticated';

export async function verifyPassword(password: string): Promise<boolean> {
  const envHash = process.env.ADMIN_PASSWORD_HASH;
  if (!envHash) {
    // Fallback: plain-text compare against ADMIN_PASSWORD env var
    return password === (process.env.ADMIN_PASSWORD ?? 'admin123');
  }
  return bcrypt.compare(password, envHash);
}

export async function setAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, SESSION_VALUE, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 hours
  });
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE);
  return cookie?.value === SESSION_VALUE;
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// Returns a 401 Response if not authenticated, otherwise null.
// Usage: const unauth = await requireAuth(); if (unauth) return unauth;
export async function requireAuth(): Promise<Response | null> {
  const authed = await isAuthenticated();
  if (!authed) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return null;
}
