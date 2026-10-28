import { getDb, initSchema } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';

// GET /api/super/events — all events from all users with owner info
export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) return auth;

  const db = getDb();
  await initSchema();

  const result = await db.execute(`
    SELECT e.*, u.username as owner_username, COUNT(a.id) as attendee_count
    FROM events e
    LEFT JOIN users u ON u.id = e.owner_id
    LEFT JOIN attendees a ON a.event_id = e.id
    GROUP BY e.id
    ORDER BY e.date DESC, e.created_at DESC
  `);

  return Response.json(result.rows.map((r) => ({
    id:             String(r.id),
    name:           String(r.name),
    date:           String(r.date),
    start_time:     r.start_time ? String(r.start_time) : null,
    location:       r.location   ? String(r.location)   : null,
    creator_name:   r.creator_name ? String(r.creator_name) : null,
    check_in_open:  Number(r.check_in_open),
    owner_id:       r.owner_id ? String(r.owner_id) : null,
    owner_username: r.owner_username ? String(r.owner_username) : null,
    created_at:     String(r.created_at),
    attendee_count: Number(r.attendee_count),
  })));
}
