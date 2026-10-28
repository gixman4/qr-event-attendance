import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_COOKIE = 'qr_admin_session';
const SESSION_DURATION = 60 * 60 * 8;

function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

export async function verifyPassword(password: string): Promise<boolean> {
  if (typeof password !== 'string' || !password) return false;
  const envHash = process.env.ADMIN_PASSWORD_HASH;
  if (envHash) return bcrypt.compare(password, envHash);
  const configuredPassword = process.env.ADMIN_PASSWORD;
  return Boolean(configuredPassword && password === configuredPassword);
}

export async function setAuthCookie(): Promise<void> {
  const secret = sessionSecret();
  if (!secret) throw new Error('SESSION_SECRET must be at least 32 characters.');

  const expires = Math.floor(Date.now() / 1000) + SESSION_DURATION;
  const payload = `v1.${expires}.${randomBytes(16).toString('hex')}`;
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DURATION,
  });
}

export async function isAuthenticated(): Promise<boolean> {
  const secret = sessionSecret();
  if (!secret) return false;
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  const [version, expiry, nonce, signature] = parts;
  if (version !== 'v1' || !/^\d{10}$/.test(expiry) || !/^[a-f0-9]{32}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if (Number(expiry) <= Math.floor(Date.now() / 1000)) return false;

  const expected = createHmac('sha256', secret).update(`${version}.${expiry}.${nonce}`).digest();
  return timingSafeEqual(Buffer.from(signature, 'hex'), expected);
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
