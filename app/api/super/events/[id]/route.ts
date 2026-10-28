import { getDb, initSchema } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';
import { writeLog } from '@/lib/log';

// DELETE /api/super/events/[id] — force-delete any event
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const db = getDb();
  await initSchema();

  const eventResult = await db.execute({ sql: 'SELECT name, owner_id FROM events WHERE id = ?', args: [id] });
  if (eventResult.rows.length === 0) {
    return Response.json({ error: 'Event not found.' }, { status: 404 });
  }
  const eventName = String(eventResult.rows[0].name);

  const transaction = await db.transaction('write');
  let committed = false;
  try {
    await transaction.execute({ sql: 'DELETE FROM attendees WHERE event_id = ?', args: [id] });
    await transaction.execute({ sql: 'DELETE FROM events WHERE id = ?', args: [id] });
    await transaction.commit();
    committed = true;
  } finally {
    if (!committed) await transaction.rollback().catch(() => {});
    transaction.close();
  }

  await writeLog(auth.userId, auth.username, 'event.force_delete', `event: ${eventName}`);
  return Response.json({ success: true });
}
