import { getDb } from '@/lib/db';
import { randomUUID } from 'crypto';

// POST /api/events/[id]/attend — register an attendee
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const eventResult = await db.execute({
    sql: 'SELECT * FROM events WHERE id = ?',
    args: [id],
  });

  if (eventResult.rows.length === 0) {
    return Response.json({ error: 'Event not found.' }, { status: 404 });
  }

  const { first_name, last_name } = await request.json();
  if (!first_name?.trim() || !last_name?.trim()) {
    return Response.json({ error: 'First name and last name are required.' }, { status: 400 });
  }

  const attendeeId = randomUUID();
  await db.execute({
    sql: 'INSERT INTO attendees (id, event_id, first_name, last_name) VALUES (?, ?, ?, ?)',
    args: [attendeeId, id, first_name.trim(), last_name.trim()],
  });

  return Response.json({ success: true, message: 'Registered successfully!' }, { status: 201 });
}
