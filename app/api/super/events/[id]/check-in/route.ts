import { getDb, initSchema } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';
import { writeLog } from '@/lib/log';

// PATCH /api/super/events/[id]/check-in — force open or close check-in on any event
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) return auth;

  const { check_in_open } = await request.json() as { check_in_open?: unknown };
  if (typeof check_in_open !== 'boolean') {
    return Response.json({ error: 'check_in_open must be true or false.' }, { status: 400 });
  }

  const { id } = await params;
  const db = getDb();
  await initSchema();

  const update = await db.execute({
    sql: 'UPDATE events SET check_in_open = ? WHERE id = ? RETURNING name',
    args: [check_in_open ? 1 : 0, id],
  });
  if (update.rows.length === 0) {
    return Response.json({ error: 'Event not found.' }, { status: 404 });
  }

  const action = check_in_open ? 'event.force_open' : 'event.force_close';
  await writeLog(auth.userId, auth.username, action, `event: ${String(update.rows[0].name)}`);
  return Response.json({ success: true, check_in_open });
}
