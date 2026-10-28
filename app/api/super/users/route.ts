import { getDb, initSchema } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';

// GET /api/super/users — list all users with event counts
export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) return auth;

  const db = getDb();
  await initSchema();

  const result = await db.execute(`
    SELECT u.id, u.username, u.role, u.created_at, COUNT(e.id) as event_count
    FROM users u
    LEFT JOIN events e ON e.owner_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at ASC
  `);

  return Response.json(result.rows.map((r) => ({
    id:          String(r.id),
    username:    String(r.username),
    role:        String(r.role),
    created_at:  String(r.created_at),
    event_count: Number(r.event_count),
  })));
}
