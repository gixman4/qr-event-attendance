import { getDb, initSchema } from '@/lib/db';
import { setAuthCookie } from '@/lib/auth';
import { writeLog } from '@/lib/log';
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

  // Check registration mode.
  const settingResult = await db.execute({
    sql: "SELECT value FROM settings WHERE key = 'registration_mode'",
    args: [],
  });
  const mode = settingResult.rows.length > 0 ? String(settingResult.rows[0].value) : 'open';
  if (mode === 'closed') {
    return Response.json({ error: 'Registration is currently closed.' }, { status: 403 });
  }

  // Check for existing username (case-insensitive).
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

  // Run the super-admin seed in case gchikvinidze just registered.
  await db.execute({
    sql: "UPDATE users SET role = 'super_admin' WHERE username = 'gchikvinidze' AND role = 'user'",
    args: [],
  });

  // Fetch the actual role (may have been promoted above).
  const newUser = await db.execute({ sql: 'SELECT role FROM users WHERE id = ?', args: [id] });
  const role = newUser.rows.length > 0 ? String(newUser.rows[0].role) : 'user';

  await writeLog(id, username, 'user.register', `username: ${username}`);

  try {
    await setAuthCookie(id, username, role);
  } catch {
    return Response.json({ error: 'Session authentication is not configured.' }, { status: 503 });
  }

  return Response.json({ success: true, username, role }, { status: 201 });
}
