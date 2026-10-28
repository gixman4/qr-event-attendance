import { getDb, initSchema } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { randomUUID } from 'crypto';

// GET /api/events — list all events with attendee counts (protected)
export async function GET() {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  const db = getDb();
  await initSchema();

  const result = await db.execute(`
    SELECT e.*, COUNT(a.id) as attendee_count
    FROM events e
    LEFT JOIN attendees a ON a.event_id = e.id
    GROUP BY e.id
    ORDER BY e.date DESC, e.created_at DESC
  `);

  const events = result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    date: r.date,
    creator_name: r.creator_name,
    created_at: r.created_at,
    attendee_count: Number(r.attendee_count ?? 0),
  }));

  return Response.json(events);
}

// POST /api/events — create a new event (protected)
export async function POST(request: Request) {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  const { creator_name, name, date } = await request.json();
  if (typeof creator_name !== 'string' || !creator_name.trim()) {
    return Response.json({ error: 'Created by is required.' }, { status: 400 });
  }
  if (creator_name.trim().length > 100) {
    return Response.json({ error: 'Created by must be 100 characters or fewer.' }, { status: 400 });
  }
  if (typeof name !== 'string' || !name.trim() || typeof date !== 'string' || !date.trim()) {
    return Response.json({ error: 'Name and date are required.' }, { status: 400 });
  }

  const db = getDb();
  await initSchema();
  const id = randomUUID();

  await db.execute({
    sql: 'INSERT INTO events (id, name, date, creator_name) VALUES (?, ?, ?, ?)',
    args: [id, name.trim(), date.trim(), creator_name.trim()],
  });

  const result = await db.execute({
    sql: 'SELECT * FROM events WHERE id = ?',
    args: [id],
  });

  return Response.json(result.rows[0], { status: 201 });
}
