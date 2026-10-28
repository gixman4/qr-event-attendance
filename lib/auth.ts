import { cookies } from 'next/headers';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_COOKIE = 'qr_admin_session';
const SESSION_DURATION = 60 * 60 * 8; // 8 hours

export interface SessionUser {
  userId: string;
  username: string;
  role: string;
}

function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

// Token format: v3.<expiry>.<nonce>.<userId>.<b64username>.<b64role>.<signature>
// All identity fields are embedded so routes never need an extra DB lookup.

export async function setAuthCookie(userId: string, username: string, role: string): Promise<void> {
  const secret = sessionSecret();
  if (!secret) throw new Error('SESSION_SECRET must be at least 32 characters.');

  const expires = Math.floor(Date.now() / 1000) + SESSION_DURATION;
  const nonce = randomBytes(16).toString('hex');
  const b64username = Buffer.from(username, 'utf8').toString('base64url');
  const b64role = Buffer.from(role, 'utf8').toString('base64url');
  const payload = `v3.${expires}.${nonce}.${userId}.${b64username}.${b64role}`;
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

export async function getSession(): Promise<SessionUser | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  if (!value) return null;

  // Split signature off the right end.
  const lastDot = value.lastIndexOf('.');
  if (lastDot === -1) return null;
  const body = value.slice(0, lastDot);
  const signature = value.slice(lastDot + 1);

  if (!/^[a-f0-9]{64}$/.test(signature)) return null;

  const expected = createHmac('sha256', secret).update(body).digest();
  const valid = timingSafeEqual(Buffer.from(signature, 'hex'), expected);
  if (!valid) return null;

  const parts = body.split('.');

  // v3: version . expiry . nonce . userId . b64username . b64role = 6 parts
  if (parts.length === 6 && parts[0] === 'v3') {
    const [, expiry, nonce, userId, b64username, b64role] = parts;
    if (!/^\d{10}$/.test(expiry)) return null;
    if (!/^[a-f0-9]{32}$/.test(nonce)) return null;
    if (Number(expiry) <= Math.floor(Date.now() / 1000)) return null;
    try {
      const username = Buffer.from(b64username, 'base64url').toString('utf8');
      const role = Buffer.from(b64role, 'base64url').toString('utf8');
      if (!username || !role) return null;
      return { userId, username, role };
    } catch {
      return null;
    }
  }

  // v2 legacy: version . expiry . nonce . userId . b64username = 5 parts
  // Treat legacy tokens as role='user' — they will refresh on next login.
  if (parts.length === 5 && parts[0] === 'v2') {
    const [, expiry, nonce, userId, b64username] = parts;
    if (!/^\d{10}$/.test(expiry)) return null;
    if (!/^[a-f0-9]{32}$/.test(nonce)) return null;
    if (Number(expiry) <= Math.floor(Date.now() / 1000)) return null;
    try {
      const username = Buffer.from(b64username, 'base64url').toString('utf8');
      if (!username) return null;
      return { userId, username, role: 'user' };
    } catch {
      return null;
    }
  }

  return null;
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// Returns 401 if not authenticated, otherwise returns the session.
export async function requireAuth(): Promise<Response | SessionUser> {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return session;
}

// Returns 401/403 if not a super_admin, otherwise returns the session.
export async function requireSuperAdmin(): Promise<Response | SessionUser> {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (session.role !== 'super_admin') {
    return Response.json({ error: 'Forbidden.' }, { status: 403 });
  }
  return session;
}
