import { getDb, initSchema } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';
import { writeLog } from '@/lib/log';

// DELETE /api/super/users/[uid] — delete a user and all their events + attendees
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) return auth;

  const { uid } = await params;
  const db = getDb();
  await initSchema();

  // Prevent self-deletion.
  if (uid === auth.userId) {
    return Response.json({ error: 'You cannot delete your own account.' }, { status: 400 });
  }

  const userResult = await db.execute({ sql: 'SELECT username FROM users WHERE id = ?', args: [uid] });
  if (userResult.rows.length === 0) {
    return Response.json({ error: 'User not found.' }, { status: 404 });
  }
  const targetUsername = String(userResult.rows[0].username);

  const transaction = await db.transaction('write');
  let committed = false;
  try {
    // Delete attendees of the user's events.
    await transaction.execute({
      sql: 'DELETE FROM attendees WHERE event_id IN (SELECT id FROM events WHERE owner_id = ?)',
      args: [uid],
    });
    await transaction.execute({ sql: 'DELETE FROM events WHERE owner_id = ?', args: [uid] });
    await transaction.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [uid] });
    await transaction.commit();
    committed = true;
  } finally {
    if (!committed) await transaction.rollback().catch(() => {});
    transaction.close();
  }

  await writeLog(auth.userId, auth.username, 'user.delete', `username: ${targetUsername}`);
  return Response.json({ success: true });
}
