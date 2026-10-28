import { getDb, initSchema } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';
import { writeLog } from '@/lib/log';

// GET /api/super/settings — read platform settings
export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) return auth;

  const db = getDb();
  await initSchema();

  const result = await db.execute('SELECT key, value FROM settings');
  const settings: Record<string, string> = {};
  for (const row of result.rows) {
    settings[String(row.key)] = String(row.value);
  }
  return Response.json(settings);
}

// PATCH /api/super/settings — update a setting
export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) return auth;

  const body = await request.json() as Record<string, unknown>;
  const db = getDb();
  await initSchema();

  // Only allow updating known settings.
  const ALLOWED_KEYS = ['registration_mode'];
  const REGISTRATION_MODES = ['open', 'invite_only', 'closed'];

  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_KEYS.includes(key)) {
      return Response.json({ error: `Unknown setting: ${key}` }, { status: 400 });
    }
    if (key === 'registration_mode' && !REGISTRATION_MODES.includes(String(value))) {
      return Response.json({ error: 'registration_mode must be open, invite_only, or closed.' }, { status: 400 });
    }
    await db.execute({
      sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      args: [key, String(value)],
    });
    await writeLog(auth.userId, auth.username, `settings.${key}`, `${key}: ${value}`);
  }

  return Response.json({ success: true });
}
