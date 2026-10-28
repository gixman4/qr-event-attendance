import { getDb, initSchema } from '@/lib/db';

// Only event details and check-in status are public; attendee data stays private.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  await initSchema();
  const result = await db.execute({
    sql: 'SELECT name, date, start_time, location, check_in_open FROM events WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) {
    return Response.json({ error: 'Event not found.' }, { status: 404 });
  }
  return Response.json({ event: result.rows[0] });
}
