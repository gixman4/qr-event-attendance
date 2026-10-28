import { getDb, initSchema } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';

// GET /api/super/stats — platform-wide statistics
export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) return auth;

  const db = getDb();
  await initSchema();

  const [usersResult, eventsResult, attendeesResult, topUsersResult, todayResult] = await Promise.all([
    db.execute('SELECT COUNT(*) as count FROM users'),
    db.execute('SELECT COUNT(*) as count FROM events'),
    db.execute('SELECT COUNT(*) as count FROM attendees'),
    db.execute(`
      SELECT u.id, u.username, u.role, COUNT(e.id) as event_count
      FROM users u
      LEFT JOIN events e ON e.owner_id = u.id
      GROUP BY u.id
      ORDER BY event_count DESC
      LIMIT 5
    `),
    db.execute({
      sql: "SELECT COUNT(*) as count FROM events WHERE date = date('now')",
      args: [],
    }),
  ]);

  return Response.json({
    totalUsers:     Number(usersResult.rows[0].count),
    totalEvents:    Number(eventsResult.rows[0].count),
    totalAttendees: Number(attendeesResult.rows[0].count),
    eventsToday:    Number(todayResult.rows[0].count),
    topUsers: topUsersResult.rows.map((r) => ({
      id:          String(r.id),
      username:    String(r.username),
      role:        String(r.role),
      event_count: Number(r.event_count),
    })),
  });
}
