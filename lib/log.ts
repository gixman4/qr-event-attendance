import { getDb } from './db';
import { randomUUID } from 'crypto';

/**
 * Write an audit log entry. Fire-and-forget safe — errors are swallowed so
 * logging never blocks or crashes the main request path.
 */
export async function writeLog(
  actorId: string | null,
  actorName: string | null,
  action: string,
  target?: string,
): Promise<void> {
  try {
    const db = getDb();
    await db.execute({
      sql: 'INSERT INTO logs (id, actor_id, actor_name, action, target) VALUES (?, ?, ?, ?, ?)',
      args: [randomUUID(), actorId, actorName, action, target ?? null],
    });
  } catch {
    // Never let logging errors surface to callers.
  }
}
