import { getDb, initSchema } from '@/lib/db';

// Only the event name and date are needed on the public check-in page.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  await initSchema();
  const result = await db.execute({
    sql: 'SELECT name, date FROM events WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) {
    return Response.json({ error: 'Event not found.' }, { status: 404 });
  }
  return Response.json({ event: result.rows[0] });
}
