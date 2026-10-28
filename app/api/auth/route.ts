import { getDb, initSchema } from '@/lib/db';
import { setAuthCookie, clearAuthCookie, getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// GET /api/auth — check if current session is valid; returns username when it is
export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ authenticated: false }, { status: 401 });
  }
  return Response.json({ authenticated: true, username: session.username });
}

// POST /api/auth — login with username + password
export async function POST(request: Request) {
  const body = await request.json();
  const { username, password } = body as { username?: unknown; password?: unknown };

  if (typeof username !== 'string' || !username.trim()) {
    return Response.json({ error: 'Username is required.' }, { status: 400 });
  }
  if (typeof password !== 'string' || !password) {
    return Response.json({ error: 'Password is required.' }, { status: 400 });
  }

  const db = getDb();
  await initSchema();

  const result = await db.execute({
    sql: 'SELECT id, username, password_hash FROM users WHERE username = ?',
    args: [username.trim()],
  });

  if (result.rows.length === 0) {
    return Response.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, String(user.password_hash));
  if (!valid) {
    return Response.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  try {
    await setAuthCookie(String(user.id), String(user.username));
  } catch {
    return Response.json({ error: 'Session authentication is not configured.' }, { status: 503 });
  }

  return Response.json({ success: true, username: String(user.username) });
}

// DELETE /api/auth — logout
export async function DELETE() {
  await clearAuthCookie();
  return Response.json({ success: true });
}
