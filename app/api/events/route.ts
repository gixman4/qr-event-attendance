import { getDb, initSchema } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { randomUUID } from 'crypto';
import { parseEventExtras } from '@/lib/event-fields';

// GET /api/events — list the current user's events with attendee counts (protected)
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const db = getDb();
  await initSchema();

  const result = await db.execute({
    sql: `
      SELECT e.*, COUNT(a.id) as attendee_count
      FROM events e
      LEFT JOIN attendees a ON a.event_id = e.id
      WHERE e.owner_id = ?
      GROUP BY e.id
      ORDER BY e.date DESC, e.created_at DESC
    `,
    args: [userId],
  });

  const events = result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    date: r.date,
    creator_name: r.creator_name,
    start_time: r.start_time,
    location: r.location,
    check_in_open: Number(r.check_in_open),
    owner_id: r.owner_id,
    created_at: r.created_at,
    attendee_count: Number(r.attendee_count ?? 0),
  }));

  return Response.json(events);
}

// POST /api/events — create a new event owned by the current user (protected)
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { userId, username } = auth;

  const { name, date, start_time, location } = await request.json();
  if (typeof name !== 'string' || !name.trim() || typeof date !== 'string' || !date.trim()) {
    return Response.json({ error: 'Name and date are required.' }, { status: 400 });
  }
  const extras = parseEventExtras(start_time, location);
  if ('error' in extras) return Response.json({ error: extras.error }, { status: 400 });

  const db = getDb();
  await initSchema();
  const id = randomUUID();

  await db.execute({
    sql: 'INSERT INTO events (id, name, date, creator_name, start_time, location, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [id, name.trim(), date.trim(), username, extras.startTime, extras.location, userId],
  });

  const result = await db.execute({
    sql: 'SELECT * FROM events WHERE id = ?',
    args: [id],
  });

  return Response.json(result.rows[0], { status: 201 });
}
