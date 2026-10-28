import { getDb, initSchema } from '@/lib/db';
import { randomUUID } from 'crypto';

// GET /api/events — list all events with attendee counts
export async function GET() {
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
    created_at: r.created_at,
    attendee_count: Number(r.attendee_count ?? 0),
  }));

  return Response.json(events);
}

// POST /api/events — create a new event
export async function POST(request: Request) {
  const { name, date } = await request.json();

  if (!name?.trim() || !date?.trim()) {
    return Response.json({ error: 'Name and date are required.' }, { status: 400 });
  }

  const db = getDb();
  await initSchema();
  const id = randomUUID();

  await db.execute({
    sql: 'INSERT INTO events (id, name, date) VALUES (?, ?, ?)',
    args: [id, name.trim(), date.trim()],
  });

  const result = await db.execute({
    sql: 'SELECT * FROM events WHERE id = ?',
    args: [id],
  });

  return Response.json(result.rows[0], { status: 201 });
}
