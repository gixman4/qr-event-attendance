import { backfillEventNameKeys, getDb, initSchema } from '@/lib/db';
import { normalizePersonName, personNameKey } from '@/lib/event-search.mts';
import { randomUUID } from 'crypto';

// POST /api/events/[id]/attend — public (attendees submit this from their phones)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { first_name, last_name, confirm_duplicate } = await request.json();
  if (typeof first_name !== 'string' || typeof last_name !== 'string') {
    return Response.json({ error: 'First name and last name are required.' }, { status: 400 });
  }
  const firstName = normalizePersonName(first_name);
  const lastName = normalizePersonName(last_name);
  if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100) {
    return Response.json({ error: 'First and last name must each be 1–100 characters.' }, { status: 400 });
  }
  if (confirm_duplicate !== undefined && typeof confirm_duplicate !== 'boolean') {
    return Response.json({ error: 'Invalid duplicate confirmation.' }, { status: 400 });
  }

  await initSchema();
  const db = getDb();
  const currentEvent = await db.execute({ sql: 'SELECT check_in_open FROM events WHERE id = ?', args: [id] });
  if (currentEvent.rows.length === 0) {
    return Response.json({ error: 'Event not found.' }, { status: 404 });
  }
  if (Number(currentEvent.rows[0].check_in_open) !== 1) {
    return Response.json({ code: 'CHECK_IN_CLOSED', error: 'Check-in is closed for this event.' }, { status: 403 });
  }
  // An unusually large old event may require multiple safe, bounded retries.
  // Never silently miss a duplicate while old attendee keys are incomplete.
  const keysReady = await backfillEventNameKeys(id);
  if (!keysReady) {
    return Response.json({
      code: 'CHECK_IN_PREPARING',
      error: 'Check-in is being prepared for this event. Please try again shortly.',
    }, { status: 503 });
  }
  // A write transaction serializes public registrations with each other and
  // with the admin's close/reopen operation across serverless instances.
  const transaction = await db.transaction('write');
  let committed = false;
  try {
    const eventResult = await transaction.execute({
      sql: 'SELECT check_in_open FROM events WHERE id = ?',
      args: [id],
    });
    if (eventResult.rows.length === 0) {
      return Response.json({ error: 'Event not found.' }, { status: 404 });
    }
    if (Number(eventResult.rows[0].check_in_open) !== 1) {
      return Response.json({ code: 'CHECK_IN_CLOSED', error: 'Check-in is closed for this event.' }, { status: 403 });
    }

    const firstKey = personNameKey(firstName);
    const lastKey = personNameKey(lastName);
    const matching = await transaction.execute({
      sql: 'SELECT 1 FROM attendees WHERE event_id = ? AND first_name_key = ? AND last_name_key = ? LIMIT 1',
      args: [id, firstKey, lastKey],
    });
    const duplicate = matching.rows.length > 0;
    // A previous deployment can still insert an unkeyed row while the new
    // version is rolling out. Retry rather than giving a false "new" result.
    if (!duplicate) {
      const unkeyed = await transaction.execute({
        sql: 'SELECT 1 FROM attendees INDEXED BY idx_attendees_unkeyed_event WHERE event_id = ? AND (first_name_key IS NULL OR last_name_key IS NULL) LIMIT 1',
        args: [id],
      });
      if (unkeyed.rows.length > 0) {
        return Response.json({
          code: 'CHECK_IN_PREPARING',
          error: 'Check-in is being prepared for this event. Please try again shortly.',
        }, { status: 503 });
      }
    }
    if (duplicate && confirm_duplicate !== true) {
      return Response.json({
        code: 'DUPLICATE_NAME',
        error: 'Someone with this name has already checked in. If you are a different person with the same name, please confirm.',
      }, { status: 409 });
    }

    await transaction.execute({
      sql: 'INSERT INTO attendees (id, event_id, first_name, last_name, first_name_key, last_name_key) VALUES (?, ?, ?, ?, ?, ?)',
      args: [randomUUID(), id, firstName, lastName, firstKey, lastKey],
    });
    await transaction.commit();
    committed = true;
    return Response.json({ success: true, message: 'Registered successfully!' }, { status: 201 });
  } finally {
    if (!committed) await transaction.rollback().catch(() => {});
    transaction.close();
  }
}
