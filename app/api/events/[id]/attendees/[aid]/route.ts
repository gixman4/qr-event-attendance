import { getDb } from '@/lib/db';

// DELETE /api/events/[id]/attendees/[aid] — remove a single attendee
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  const { id, aid } = await params;
  const db = getDb();

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
