import { cookies } from 'next/headers';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_COOKIE = 'qr_admin_session';
const SESSION_DURATION = 60 * 60 * 8; // 8 hours

export interface SessionUser {
  userId: string;
  username: string;
}

function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

// Token format: v2.<expiry>.<nonce>.<userId>.<b64username>.<signature>
// userId and username are embedded so every API route can enforce ownership
// without an extra DB lookup per request.

export async function setAuthCookie(userId: string, username: string): Promise<void> {
  const secret = sessionSecret();
  if (!secret) throw new Error('SESSION_SECRET must be at least 32 characters.');

  const expires = Math.floor(Date.now() / 1000) + SESSION_DURATION;
  const nonce = randomBytes(16).toString('hex');
  const b64username = Buffer.from(username, 'utf8').toString('base64url');
  const payload = `v2.${expires}.${nonce}.${userId}.${b64username}`;
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

  // Split from the right so userId/username dots don't confuse the split.
  const lastDot = value.lastIndexOf('.');
  if (lastDot === -1) return null;
  const body = value.slice(0, lastDot);
  const signature = value.slice(lastDot + 1);

  const parts = body.split('.');
  // v2 . expiry . nonce . userId . b64username  = 5 parts
  if (parts.length !== 5) return null;
  const [version, expiry, nonce, userId, b64username] = parts;
  if (version !== 'v2') return null;
  if (!/^\d{10}$/.test(expiry)) return null;
  if (!/^[a-f0-9]{32}$/.test(nonce)) return null;
  if (Number(expiry) <= Math.floor(Date.now() / 1000)) return null;
  if (!/^[a-f0-9]{64}$/.test(signature)) return null;

  const expected = createHmac('sha256', secret).update(body).digest();
  const valid = timingSafeEqual(Buffer.from(signature, 'hex'), expected);
  if (!valid) return null;

  let username: string;
  try {
    username = Buffer.from(b64username, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!username) return null;

  return { userId, username };
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// Returns a 401 Response if not authenticated, otherwise returns the session.
// Usage:
//   const auth = await requireAuth();
//   if (auth instanceof Response) return auth;
//   const { userId, username } = auth;
export async function requireAuth(): Promise<Response | SessionUser> {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return session;
}
