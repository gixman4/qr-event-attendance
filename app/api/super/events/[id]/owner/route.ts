import { getDb, initSchema } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';
import { writeLog } from '@/lib/log';

// PATCH /api/super/events/[id]/owner — transfer event ownership to another user
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) return auth;

  const { new_owner_id } = await request.json() as { new_owner_id?: unknown };
  if (typeof new_owner_id !== 'string' || !new_owner_id) {
    return Response.json({ error: 'new_owner_id is required.' }, { status: 400 });
  }

  const { id } = await params;
  const db = getDb();
  await initSchema();

  const [eventResult, newOwnerResult] = await Promise.all([
    db.execute({ sql: 'SELECT name, owner_id FROM events WHERE id = ?', args: [id] }),
    db.execute({ sql: 'SELECT username FROM users WHERE id = ?', args: [new_owner_id] }),
  ]);

  if (eventResult.rows.length === 0) {
    return Response.json({ error: 'Event not found.' }, { status: 404 });
  }
  if (newOwnerResult.rows.length === 0) {
    return Response.json({ error: 'New owner user not found.' }, { status: 404 });
  }

  const eventName     = String(eventResult.rows[0].name);
  const newOwnerName  = String(newOwnerResult.rows[0].username);

  await db.execute({
    sql: 'UPDATE events SET owner_id = ?, creator_name = ? WHERE id = ?',
    args: [new_owner_id, newOwnerName, id],
  });

  await writeLog(auth.userId, auth.username, 'event.transfer', `event: ${eventName} → ${newOwnerName}`);
  return Response.json({ success: true });
}
