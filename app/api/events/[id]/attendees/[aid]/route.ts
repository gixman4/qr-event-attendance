import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// DELETE /api/events/[id]/attendees/[aid] — remove a single attendee (protected, owner only)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const { id, aid } = await params;
  const db = getDb();

  // Verify that the event exists and belongs to the current user.
  const eventResult = await db.execute({
    sql: 'SELECT owner_id FROM events WHERE id = ?',
    args: [id],
  });
  if (eventResult.rows.length === 0) {
    return Response.json({ error: 'Event not found.' }, { status: 404 });
  }
  if (String(eventResult.rows[0].owner_id) !== userId) {
    return Response.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const result = await db.execute({
    sql: 'SELECT * FROM attendees WHERE id = ? AND event_id = ?',
    args: [aid, id],
  });

  if (result.rows.length === 0) {
    return Response.json({ error: 'Attendee not found.' }, { status: 404 });
  }

  await db.execute({ sql: 'DELETE FROM attendees WHERE id = ?', args: [aid] });
  return Response.json({ success: true });
}
