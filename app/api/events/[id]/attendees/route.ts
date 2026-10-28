import { getDb, initSchema } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { normalizePersonName, personNameKey } from '@/lib/event-search.mts';
import { randomUUID } from 'crypto';

// POST /api/events/[id]/attendees — manually add an attendee (protected)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = await requireAuth();
  if (unauth) return unauth;

  const { id } = await params;
  await initSchema();
  const db = getDb();

  const { first_name, last_name } = await request.json();
  if (typeof first_name !== 'string' || typeof last_name !== 'string') {
    return Response.json({ error: 'First name and last name are required.' }, { status: 400 });
  }
  const firstName = normalizePersonName(first_name);
  const lastName = normalizePersonName(last_name);
  if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100) {
    return Response.json({ error: 'First and last name must each be 1–100 characters.' }, { status: 400 });
  }

  const attendeeId = randomUUID();
  const transaction = await db.transaction('write');
  let committed = false;
  try {
    const eventResult = await transaction.execute({ sql: 'SELECT id FROM events WHERE id = ?', args: [id] });
    if (eventResult.rows.length === 0) {
      return Response.json({ error: 'Event not found.' }, { status: 404 });
    }
    // Admin additions stay available even while public check-in is closed.
    await transaction.execute({
      sql: 'INSERT INTO attendees (id, event_id, first_name, last_name, first_name_key, last_name_key) VALUES (?, ?, ?, ?, ?, ?)',
      args: [attendeeId, id, firstName, lastName, personNameKey(firstName), personNameKey(lastName)],
    });
    const created = await transaction.execute({ sql: 'SELECT * FROM attendees WHERE id = ?', args: [attendeeId] });
    await transaction.commit();
    committed = true;
    return Response.json(created.rows[0], { status: 201 });
  } finally {
    if (!committed) await transaction.rollback().catch(() => {});
    transaction.close();
  }

}
