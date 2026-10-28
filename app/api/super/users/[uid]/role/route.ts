import { getDb, initSchema } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';
import { writeLog } from '@/lib/log';

// PATCH /api/super/users/[uid]/role — promote or demote a user
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) return auth;

  const { uid } = await params;
  const { role } = await request.json() as { role?: unknown };

  if (role !== 'user' && role !== 'super_admin') {
    return Response.json({ error: 'Role must be "user" or "super_admin".' }, { status: 400 });
  }

  // Prevent demoting yourself.
  if (uid === auth.userId && role !== 'super_admin') {
    return Response.json({ error: 'You cannot demote your own account.' }, { status: 400 });
  }

  const db = getDb();
  await initSchema();

  const userResult = await db.execute({ sql: 'SELECT username, role FROM users WHERE id = ?', args: [uid] });
  if (userResult.rows.length === 0) {
    return Response.json({ error: 'User not found.' }, { status: 404 });
  }

  const targetUsername = String(userResult.rows[0].username);
  const previousRole   = String(userResult.rows[0].role);

  await db.execute({ sql: 'UPDATE users SET role = ? WHERE id = ?', args: [role, uid] });

  const action = role === 'super_admin' ? 'role.promote' : 'role.demote';
  await writeLog(auth.userId, auth.username, action, `username: ${targetUsername} (${previousRole} → ${role})`);

  return Response.json({ success: true, role });
}
