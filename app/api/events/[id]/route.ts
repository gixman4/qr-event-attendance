import { getDb, initSchema } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { parseEventExtras } from '@/lib/event-fields';

// GET /api/events/[id] — full event including attendee list (protected, owner only)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { userId } = auth;

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

  if (String(eventResult.rows[0].owner_id) !== userId) {
    return Response.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const attendeesResult = await db.execute({
    sql: 'SELECT * FROM attendees WHERE event_id = ? ORDER BY registered_at ASC, rowid ASC',
    args: [id],
  });

  return Response.json({ event: eventResult.rows[0], attendees: attendeesResult.rows });
}

// PUT /api/events/[id] — update event (protected, owner only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { userId } = auth;

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
  if (String(eventResult.rows[0].owner_id) !== userId) {
    return Response.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { name, date, start_time, location } = await request.json();
  if (typeof name !== 'string' || !name.trim() || typeof date !== 'string' || !date.trim()) {
    return Response.json({ error: 'Name and date are required.' }, { status: 400 });
  }
  const previous = eventResult.rows[0];
  const extras = parseEventExtras(
    start_time === undefined ? previous.start_time : start_time,
    location === undefined ? previous.location : location,
  );
  if ('error' in extras) return Response.json({ error: extras.error }, { status: 400 });

  await db.execute({
    sql: 'UPDATE events SET name = ?, date = ?, start_time = ?, location = ? WHERE id = ?',
    args: [name.trim(), date.trim(), extras.startTime, extras.location, id],
  });

  const updated = await db.execute({
    sql: 'SELECT * FROM events WHERE id = ?',
    args: [id],
  });

  return Response.json(updated.rows[0]);
}

// PATCH /api/events/[id] — close/reopen public check-in (protected, owner only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const { check_in_open } = await request.json();
  if (typeof check_in_open !== 'boolean') {
    return Response.json({ error: 'Check-in status must be true or false.' }, { status: 400 });
  }
  const { id } = await params;
  await initSchema();
  const db = getDb();

  // Verify ownership before updating.
  const existing = await db.execute({ sql: 'SELECT owner_id FROM events WHERE id = ?', args: [id] });
  if (existing.rows.length === 0) {
    return Response.json({ error: 'Event not found.' }, { status: 404 });
  }
  if (String(existing.rows[0].owner_id) !== userId) {
    return Response.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const update = await db.execute({
    sql: 'UPDATE events SET check_in_open = ? WHERE id = ? RETURNING *',
    args: [check_in_open ? 1 : 0, id],
  });
  return Response.json(update.rows[0]);
}

// DELETE /api/events/[id] — delete event (protected, owner only)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const { id } = await params;
  await initSchema();
  const db = getDb();
  const transaction = await db.transaction('write');
  let committed = false;
  try {
    const eventResult = await transaction.execute({ sql: 'SELECT id, owner_id FROM events WHERE id = ?', args: [id] });
    if (eventResult.rows.length === 0) {
      return Response.json({ error: 'Event not found.' }, { status: 404 });
    }
    if (String(eventResult.rows[0].owner_id) !== userId) {
      return Response.json({ error: 'Forbidden.' }, { status: 403 });
    }
    await transaction.execute({ sql: 'DELETE FROM attendees WHERE event_id = ?', args: [id] });
    await transaction.execute({ sql: 'DELETE FROM events WHERE id = ?', args: [id] });
    await transaction.commit();
    committed = true;
    return Response.json({ success: true });
  } finally {
    if (!committed) await transaction.rollback().catch(() => {});
    transaction.close();
  }
}
