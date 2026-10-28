import { createClient, type Client } from '@libsql/client';

let _db: Client | null = null;

export function getDb(): Client {
  if (!_db) {
    _db = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _db;
}

export async function initSchema(): Promise<void> {
  const db = getDb();
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS events (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      date       TEXT NOT NULL,
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
}

export interface Event {
  id: string;
  name: string;
  date: string;
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
