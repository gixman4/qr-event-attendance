import { notFound, redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { getDb, initSchema } from '@/lib/db';
import Poster from './poster';
import './poster.css';

export default async function PosterPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) redirect('/admin');

  const { id } = await params;
  await initSchema();
  const result = await getDb().execute({
    sql: 'SELECT name, date FROM events WHERE id = ?',
    args: [id],
  });

  if (result.rows.length === 0) notFound();

  return <Poster id={id} name={String(result.rows[0].name)} date={String(result.rows[0].date)} />;
}
