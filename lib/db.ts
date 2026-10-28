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

  // --- users table ---
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'user',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Add role column to existing users tables that predate it.
  const userCols = await db.execute('PRAGMA table_info(users)');
  const existingUserCols = new Set(userCols.rows.map((r) => String(r.name)));
  if (!existingUserCols.has('role')) {
    try {
      await db.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
    } catch (error) {
      const recheck = await db.execute('PRAGMA table_info(users)');
      if (!recheck.rows.some((r) => r.name === 'role')) throw error;
    }
  }

  // Seed super-admin: promote gchikvinidze on every schema init (idempotent).
  await db.execute({
    sql: "UPDATE users SET role = 'super_admin' WHERE username = 'gchikvinidze' AND role = 'user'",
    args: [],
  });

  // --- events table ---
  // Clean-slate migration: if owner_id column is missing the database still
  // belongs to the old single-admin schema. Drop all rows and recreate so
  // every event is properly owned by a user from the start.
  const eventCols = await db.execute('PRAGMA table_info(events)');
  const existingEventCols = new Set(eventCols.rows.map((r) => String(r.name)));

  if (!existingEventCols.has('owner_id')) {
    await db.executeMultiple(`
      DELETE FROM attendees;
      DELETE FROM events;
    `);
    await db.execute('ALTER TABLE events ADD COLUMN owner_id TEXT REFERENCES users(id)');
  }

  // Ensure the base tables exist (idempotent).
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS events (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      date          TEXT NOT NULL,
      creator_name  TEXT,
      start_time    TEXT,
      location      TEXT,
      check_in_open INTEGER NOT NULL DEFAULT 1,
      owner_id      TEXT REFERENCES users(id),
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attendees (
      id             TEXT PRIMARY KEY,
      event_id       TEXT NOT NULL,
      first_name     TEXT NOT NULL,
      last_name      TEXT NOT NULL,
      first_name_key TEXT,
      last_name_key  TEXT,
      registered_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES events(id)
    );
  `);

  // Legacy column additions for events.
  const updatedEventCols = await db.execute('PRAGMA table_info(events)');
  const allEventCols = new Set(updatedEventCols.rows.map((r) => String(r.name)));
  for (const [column, statement] of [
    ['creator_name', 'ALTER TABLE events ADD COLUMN creator_name TEXT'],
    ['start_time',   'ALTER TABLE events ADD COLUMN start_time TEXT'],
    ['location',     'ALTER TABLE events ADD COLUMN location TEXT'],
    ['check_in_open','ALTER TABLE events ADD COLUMN check_in_open INTEGER NOT NULL DEFAULT 1'],
    ['owner_id',     'ALTER TABLE events ADD COLUMN owner_id TEXT REFERENCES users(id)'],
  ]) {
    if (allEventCols.has(column)) continue;
    try {
      await db.execute(statement);
    } catch (error) {
      const recheckCols = await db.execute('PRAGMA table_info(events)');
      if (!recheckCols.rows.some((r) => r.name === column)) throw error;
    }
    allEventCols.add(column);
  }

  // Legacy column additions for attendees.
  const attendeeCols = await db.execute('PRAGMA table_info(attendees)');
  const allAttendeeCols = new Set(attendeeCols.rows.map((r) => String(r.name)));
  for (const [column, statement] of [
    ['first_name_key', 'ALTER TABLE attendees ADD COLUMN first_name_key TEXT'],
    ['last_name_key',  'ALTER TABLE attendees ADD COLUMN last_name_key TEXT'],
  ]) {
    if (allAttendeeCols.has(column)) continue;
    try {
      await db.execute(statement);
    } catch (error) {
      const recheckCols = await db.execute('PRAGMA table_info(attendees)');
      if (!recheckCols.rows.some((r) => r.name === column)) throw error;
    }
    allAttendeeCols.add(column);
  }

  await db.execute('CREATE INDEX IF NOT EXISTS idx_attendees_event_name ON attendees (event_id, first_name_key, last_name_key)');
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_attendees_unkeyed_event ON attendees (event_id)
    WHERE first_name_key IS NULL OR last_name_key IS NULL`);

  // --- logs table ---
  await db.execute(`
    CREATE TABLE IF NOT EXISTS logs (
      id         TEXT PRIMARY KEY,
      actor_id   TEXT,
      actor_name TEXT,
      action     TEXT NOT NULL,
      target     TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // --- settings table ---
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  // Seed default registration mode if not set.
  await db.execute(`
    INSERT OR IGNORE INTO settings (key, value) VALUES ('registration_mode', 'open')
  `);
}

// Migrate at most one event-sized chunk per check-in.
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
  _schemaPromise ??= ensureSchema().catch((error) => {
    _schemaPromise = undefined;
    throw error;
  });
  await _schemaPromise;
}

export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  created_at: string;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  creator_name: string | null;
  start_time: string | null;
  location: string | null;
  check_in_open: number;
  owner_id: string | null;
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

export interface Log {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  target: string | null;
  created_at: string;
}
