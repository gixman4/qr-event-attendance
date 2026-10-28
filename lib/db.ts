import { createClient, type Client } from '@libsql/client';

let _db: Client | null = null;
let _schemaPromise: Promise<void> | undefined;

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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attendees (
      id            TEXT PRIMARY KEY,
      event_id      TEXT NOT NULL,
      first_name    TEXT NOT NULL,
      last_name     TEXT NOT NULL,
      registered_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES events(id)
    );
  `);

  // Older databases already have an events table. Keep their rows and leave
  // the creator blank rather than rebuilding the table or inventing a name.
  const columns = await db.execute('PRAGMA table_info(events)');
  if (!columns.rows.some((column) => column.name === 'creator_name')) {
    try {
      await db.execute('ALTER TABLE events ADD COLUMN creator_name TEXT');
    } catch (error) {
      // Two serverless instances may discover the missing column at once.
      const updatedColumns = await db.execute('PRAGMA table_info(events)');
      if (!updatedColumns.rows.some((column) => column.name === 'creator_name')) {
        throw error;
      }
    }
  }
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
  created_at: string;
  attendee_count?: number;
}

export interface Attendee {
  id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  registered_at: string;
}
