import { getDb, initSchema } from '@/lib/db';

// GET /api/events/[id] — get a single event with attendees
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  await initSchema();

  const eventResult = await db.execute({
    sql: 'SELECT * FROM events WHERE id = ?',
    args: [id],
  });

  if (eventResult.rows.length === 0) {
    return Response.json({ error: 'Event not found.' }, { status: 404 });
  }

  const attendeesResult = await db.execute({
    sql: 'SELECT * FROM attendees WHERE event_id = ? ORDER BY registered_at ASC',
    args: [id],
  });

  return Response.json({ event: eventResult.rows[0], attendees: attendeesResult.rows });
}

// PUT /api/events/[id] — update event name and/or date
export async function PUT(
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

  const { name, date } = await request.json();
  if (!name?.trim() || !date?.trim()) {
    return Response.json({ error: 'Name and date are required.' }, { status: 400 });
  }

  await db.execute({
    sql: 'UPDATE events SET name = ?, date = ? WHERE id = ?',
    args: [name.trim(), date.trim(), id],
  });

  const updated = await db.execute({
    sql: 'SELECT * FROM events WHERE id = ?',
    args: [id],
  });

  return Response.json(updated.rows[0]);
}

// DELETE /api/events/[id] — delete event and all its attendees
export async function DELETE(
  _request: Request,
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

  await db.execute({ sql: 'DELETE FROM attendees WHERE event_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM events WHERE id = ?', args: [id] });

  return Response.json({ success: true });
}
