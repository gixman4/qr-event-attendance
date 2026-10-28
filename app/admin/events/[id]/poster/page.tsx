import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDb, initSchema } from '@/lib/db';
import Poster from './poster';
import './poster.css';

export default async function PosterPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) redirect('/admin');

  const { id } = await params;
  await initSchema();
  const result = await getDb().execute({
    sql: 'SELECT name, date, start_time, location, check_in_open FROM events WHERE id = ?',
    args: [id],
  });

  if (result.rows.length === 0) notFound();

  const event = result.rows[0];
  return (
    <Poster
      id={id}
      name={String(event.name)}
      date={String(event.date)}
      startTime={event.start_time === null ? null : String(event.start_time)}
      location={event.location === null ? null : String(event.location)}
      checkInOpen={Number(event.check_in_open) === 1}
    />
  );
}
