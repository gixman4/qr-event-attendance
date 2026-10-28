import { getDb, initSchema } from '@/lib/db';
import { setAuthCookie } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

// POST /api/auth/register — create a new user account
export async function POST(request: Request) {
  const body = await request.json();
  const { username, password } = body as { username?: unknown; password?: unknown };

  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return Response.json(
      { error: 'Username must be 3–30 characters and contain only letters, numbers, or underscores.' },
      { status: 400 },
    );
  }
  if (typeof password !== 'string' || password.length < 8) {
    return Response.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 },
    );
  }

  const db = getDb();
  await initSchema();

  // Check for existing username (case-insensitive via LOWER()).
  const existing = await db.execute({
    sql: 'SELECT id FROM users WHERE LOWER(username) = LOWER(?)',
    args: [username],
  });
  if (existing.rows.length > 0) {
    return Response.json({ error: 'Username is already taken.' }, { status: 409 });
  }

  const id = randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);

  await db.execute({
    sql: 'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)',
    args: [id, username, passwordHash],
  });

  try {
    await setAuthCookie(id, username);
  } catch {
    return Response.json({ error: 'Session authentication is not configured.' }, { status: 503 });
  }

  return Response.json({ success: true, username }, { status: 201 });
}
