import { createClient, type Client } from '@libsql/client';
import { personNameKey } from './event-search.mts';

let _db: Client | null = null;
let _schemaPromise: Promise<void> | undefined;
const activeBackfills = new Map<string, Promise<boolean>>();

export function getDb(): Client {
  if (!_db) {
    _db = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _db;
}

async function ensureSchema(): Promise<void> {
  const db = getDb();
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS events (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      date       TEXT NOT NULL,
      creator_name TEXT,
      start_time TEXT,
      location TEXT,
      check_in_open INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attendees (
      id            TEXT PRIMARY KEY,
      event_id      TEXT NOT NULL,
      first_name    TEXT NOT NULL,
      last_name     TEXT NOT NULL,
      first_name_key TEXT,
      last_name_key TEXT,
      registered_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES events(id)
    );
  `);

  // Older databases keep their existing rows; nullable details remain blank
  // and every pre-existing event remains open for check-in by default.
  const columns = await db.execute('PRAGMA table_info(events)');
  const existing = new Set(columns.rows.map((column) => String(column.name)));
  for (const [column, statement] of [
    ['creator_name', 'ALTER TABLE events ADD COLUMN creator_name TEXT'],
    ['start_time', 'ALTER TABLE events ADD COLUMN start_time TEXT'],
    ['location', 'ALTER TABLE events ADD COLUMN location TEXT'],
    ['check_in_open', 'ALTER TABLE events ADD COLUMN check_in_open INTEGER NOT NULL DEFAULT 1'],
  ]) {
    if (existing.has(column)) continue;
    try {
      await db.execute(statement);
    } catch (error) {
      // Two serverless instances may discover the missing column at once.
      const updatedColumns = await db.execute('PRAGMA table_info(events)');
      if (!updatedColumns.rows.some((row) => row.name === column)) {
        throw error;
      }
    }
    existing.add(column);
  }

  const attendeeColumns = await db.execute('PRAGMA table_info(attendees)');
  const existingAttendeeColumns = new Set(attendeeColumns.rows.map((column) => String(column.name)));
  for (const [column, statement] of [
    ['first_name_key', 'ALTER TABLE attendees ADD COLUMN first_name_key TEXT'],
    ['last_name_key', 'ALTER TABLE attendees ADD COLUMN last_name_key TEXT'],
  ]) {
    if (existingAttendeeColumns.has(column)) continue;
    try {
      await db.execute(statement);
    } catch (error) {
      const updatedColumns = await db.execute('PRAGMA table_info(attendees)');
      if (!updatedColumns.rows.some((row) => row.name === column)) throw error;
    }
    existingAttendeeColumns.add(column);
  }

  await db.execute('CREATE INDEX IF NOT EXISTS idx_attendees_event_name ON attendees (event_id, first_name_key, last_name_key)');
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_attendees_unkeyed_event ON attendees (event_id)
    WHERE first_name_key IS NULL OR last_name_key IS NULL`);
}

// Migrate at most one event-sized chunk per check-in, rather than blocking all
// requests while an unbounded historical attendee table is backfilled.
async function backfillChunk(eventId: string): Promise<boolean> {
  const db = getDb();
  const batchSize = 250;
  const legacy = await db.execute({
    sql: 'SELECT id, first_name, last_name FROM attendees INDEXED BY idx_attendees_unkeyed_event WHERE event_id = ? AND (first_name_key IS NULL OR last_name_key IS NULL) LIMIT ?',
    args: [eventId, batchSize + 1],
  });
  if (legacy.rows.length === 0) return true;
  await db.batch(legacy.rows.slice(0, batchSize).map((row) => ({
    sql: 'UPDATE attendees SET first_name_key = ?, last_name_key = ? WHERE id = ? AND (first_name_key IS NULL OR last_name_key IS NULL)',
    args: [personNameKey(String(row.first_name)), personNameKey(String(row.last_name)), String(row.id)],
  })), 'write');
  return legacy.rows.length <= batchSize;
}

export function backfillEventNameKeys(eventId: string): Promise<boolean> {
  const active = activeBackfills.get(eventId);
  if (active) return active;
  const pending = backfillChunk(eventId);
  activeBackfills.set(eventId, pending);
  void pending.then(
    () => { activeBackfills.delete(eventId); },
    () => { activeBackfills.delete(eventId); },
  );
  return pending;
}

export async function initSchema(): Promise<void> {
  // Avoid repeated schema round trips for the dashboard's live refresh.
  _schemaPromise ??= ensureSchema().catch((error) => {
    _schemaPromise = undefined;
    throw error;
  });
  await _schemaPromise;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  creator_name: string | null;
  start_time: string | null;
  location: string | null;
  check_in_open: number;
  created_at: string;
  attendee_count?: number;
}

export interface Attendee {
  id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  first_name_key: string | null;
  last_name_key: string | null;
  registered_at: string;
}
