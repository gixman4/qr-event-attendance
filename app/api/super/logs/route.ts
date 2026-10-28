import { getDb, initSchema } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';

// GET /api/super/logs — paginated audit log (50 per page)
export async function GET(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit  = 50;
  const offset = (page - 1) * limit;

  const db = getDb();
  await initSchema();

  const [logsResult, countResult] = await Promise.all([
    db.execute({
      sql: 'SELECT * FROM logs ORDER BY created_at DESC LIMIT ? OFFSET ?',
      args: [limit, offset],
    }),
    db.execute('SELECT COUNT(*) as count FROM logs'),
  ]);

  const total = Number(countResult.rows[0].count);

  return Response.json({
    logs: logsResult.rows.map((r) => ({
      id:         String(r.id),
      actor_id:   r.actor_id   ? String(r.actor_id)   : null,
      actor_name: r.actor_name ? String(r.actor_name) : null,
      action:     String(r.action),
      target:     r.target     ? String(r.target)     : null,
      created_at: String(r.created_at),
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
