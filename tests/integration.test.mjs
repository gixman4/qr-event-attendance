import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@libsql/client';
import ExcelJS from 'exceljs';

const password = `test-password-${randomUUID()}`;
const secret = `test-secret-${randomUUID()}-${randomUUID()}`;

async function availablePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test('production flow keeps admin data private and public check-in working', { timeout: 90_000 }, async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'epam-events-test-'));
  const legacyId = randomUUID();
  const legacyDb = createClient({ url: `file:${join(dir, 'events.db')}` });
  await legacyDb.execute(`
    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await legacyDb.execute({
    sql: 'INSERT INTO events (id, name, date) VALUES (?, ?, ?)',
    args: [legacyId, 'Existing Event', '2026-10-27'],
  });
  await legacyDb.execute(`
    CREATE TABLE attendees (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      registered_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES events(id)
    )
  `);
  await legacyDb.execute({
    sql: 'INSERT INTO attendees (id, event_id, first_name, last_name) VALUES (?, ?, ?, ?)',
    args: [randomUUID(), legacyId, '  MÉLODIE   ', ' CHIK  '],
  });
  legacyDb.close();
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  let logs = '';
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TURSO_DATABASE_URL: `file:${join(dir, 'events.db')}`,
      TURSO_AUTH_TOKEN: '',
      ADMIN_PASSWORD: password,
      ADMIN_PASSWORD_HASH: '',
      SESSION_SECRET: secret,
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (data) => { logs += String(data); });
  server.stderr.on('data', (data) => { logs += String(data); });
  t.after(async () => {
    server.kill('SIGTERM');
    await rm(dir, { recursive: true, force: true });
  });

  async function request(path, { cookie, ...options } = {}) {
    return fetch(`${origin}${path}`, {
      ...options,
      headers: { ...(options.headers ?? {}), ...(cookie ? { cookie } : {}) },
    });
  }

  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) break;
    try {
      const result = await request('/api/auth');
      if (result.status === 401) { ready = true; break; }
    } catch { /* server is still starting */ }
    await delay(100);
  }
  assert.ok(ready, `Server did not start: ${logs}`);

  const home = await request('/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /EPAM Events/);
  assert.equal((await request('/epam-logo.svg')).status, 200);
  assert.equal((await request('/admin')).status, 200);
  const createPage = await request('/admin/create');
  assert.equal(createPage.status, 200);
  const createHtml = await createPage.text();
  assert.ok(createHtml.includes('Created by'));
  assert.ok(createHtml.includes('Event Name'));
  assert.ok(createHtml.indexOf('Created by') < createHtml.indexOf('Event Name'));
  assert.match(createHtml, /id="creator-name"[^>]*required/);
  assert.match(createHtml, /id="event-time"/);
  assert.match(createHtml, /id="event-location"/);

  assert.equal((await request('/api/events')).status, 401);
  assert.equal((await request('/api/events', { cookie: 'qr_admin_session=authenticated' })).status, 401);
  assert.equal((await request('/api/events', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Unauthorized', date: '2026-10-28' }),
  })).status, 401);
  assert.equal((await request('/api/auth', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'wrong' }),
  })).status, 401);

  const login = await request('/api/auth', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie?.startsWith('qr_admin_session=v1.'));
  assert.equal((await request('/api/auth', { cookie })).status, 200);

  const legacyList = await request('/api/events', { cookie });
  assert.equal(legacyList.status, 200);
  const oldEvent = (await legacyList.json()).find((event) => event.id === legacyId);
  assert.equal(oldEvent.creator_name, null);
  assert.equal(oldEvent.start_time, null);
  assert.equal(oldEvent.location, null);
  assert.equal(oldEvent.check_in_open, 1);
  const legacyDetails = await request(`/api/events/${legacyId}`, { cookie });
  assert.equal(legacyDetails.status, 200);
  assert.equal((await legacyDetails.json()).event.creator_name, null);
  const legacyPoster = await request(`/admin/events/${legacyId}/poster`, { cookie });
  assert.equal(legacyPoster.status, 200);
  assert.match(await legacyPoster.text(), /Existing Event/);
  // Initializing the schema repeatedly must not lose existing events.
  assert.equal((await request('/api/events', { cookie })).status, 200);
  const inspection = createClient({ url: `file:${join(dir, 'events.db')}` });
  const beforeBackfill = await inspection.execute({
    sql: 'SELECT first_name_key, last_name_key FROM attendees WHERE event_id = ?', args: [legacyId],
  });
  assert.equal(beforeBackfill.rows[0].first_name_key, null);
  const plan = await inspection.execute({
    sql: 'EXPLAIN QUERY PLAN SELECT 1 FROM attendees WHERE event_id = ? AND first_name_key = ? AND last_name_key = ?',
    args: [legacyId, 'mélodie', 'chik'],
  });
  assert.match(JSON.stringify(plan.rows), /idx_attendees_event_name/);
  const unkeyedPlan = await inspection.execute({
    sql: 'EXPLAIN QUERY PLAN SELECT 1 FROM attendees INDEXED BY idx_attendees_unkeyed_event WHERE event_id = ? AND (first_name_key IS NULL OR last_name_key IS NULL) LIMIT 1',
    args: [legacyId],
  });
  assert.match(JSON.stringify(unkeyedPlan.rows), /idx_attendees_unkeyed_event/);
  inspection.close();
  const legacyDuplicate = await request(`/api/events/${legacyId}/attend`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ first_name: 'mélodie', last_name: 'chik' }),
  });
  assert.equal(legacyDuplicate.status, 409);
  const verified = createClient({ url: `file:${join(dir, 'events.db')}` });
  const backfilled = await verified.execute({
    sql: 'SELECT first_name_key, last_name_key FROM attendees WHERE event_id = ?', args: [legacyId],
  });
  assert.equal(backfilled.rows[0].first_name_key, 'mélodie');
  assert.equal(backfilled.rows[0].last_name_key, 'chik');
  verified.close();
  const simultaneous = await Promise.all([
    { first_name: 'ÉLISE   Anne', last_name: 'TESTER' },
    { first_name: 'élise anne', last_name: 'tester' },
  ].map((person) => request(`/api/events/${legacyId}/attend`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(person),
  })));
  const simultaneousStatuses = simultaneous.map((response) => response.status).sort();
  if (simultaneousStatuses.some((status) => status >= 500)) {
    assert.fail(`Concurrent requests failed: ${JSON.stringify(await Promise.all(simultaneous.map((response) => response.text())))}\n${logs}`);
  }
  assert.deepEqual(simultaneousStatuses, [201, 409]);
  assert.equal((await (await request(`/api/events/${legacyId}`, { cookie })).json()).attendees.length, 2);
  const [closeDuringScan, scanDuringClose] = await Promise.all([
    request(`/api/events/${legacyId}`, {
      method: 'PATCH', cookie, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ check_in_open: false }),
    }),
    request(`/api/events/${legacyId}/attend`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ first_name: 'Arriving', last_name: 'Attendee' }),
    }),
  ]);
  assert.equal(closeDuringScan.status, 200);
  assert.ok([201, 403].includes(scanDuringClose.status));
  assert.equal((await (await request(`/api/events/${legacyId}/public`)).json()).event.check_in_open, 0);
  assert.equal((await request(`/api/events/${legacyId}/attend`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ first_name: 'Too', last_name: 'Late' }),
  })).status, 403);
  assert.equal((await request(`/api/events/${legacyId}`, {
    method: 'PATCH', cookie, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ check_in_open: true }),
  })).status, 200);
  const toggles = await Promise.all([false, true].map((open) => request(`/api/events/${legacyId}`, {
    method: 'PATCH', cookie, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ check_in_open: open }),
  })));
  assert.deepEqual(toggles.map((response) => response.status), [200, 200]);
  assert.deepEqual((await Promise.all(toggles.map((response) => response.json()))).map((row) => row.check_in_open), [0, 1]);
  if ((await (await request(`/api/events/${legacyId}/public`)).json()).event.check_in_open === 0) {
    assert.equal((await request(`/api/events/${legacyId}`, {
      method: 'PATCH', cookie, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ check_in_open: true }),
    })).status, 200);
  }

  const forged = `${cookie.slice(0, -1)}${cookie.endsWith('a') ? 'b' : 'a'}`;
  assert.equal((await request('/api/events', { cookie: forged })).status, 401);
  const expiry = Math.floor(Date.now() / 1000) - 1;
  const payload = `v1.${expiry}.${'a'.repeat(32)}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  assert.equal((await request('/api/events', { cookie: `qr_admin_session=${payload}.${sig}` })).status, 401);

  async function invalidCreator(creatorName) {
    return request('/api/events', {
      method: 'POST', cookie, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Should Not Create', date: '2026-10-28', creator_name: creatorName }),
    });
  }
  for (const invalid of [undefined, '', '   ', 42, 'x'.repeat(101)]) {
    assert.equal((await invalidCreator(invalid)).status, 400);
  }
  for (const extras of [
    { start_time: '25:00' }, { start_time: '9:30' }, { start_time: 123 },
    { location: 99 }, { location: 'x'.repeat(201) },
  ]) {
    assert.equal((await request('/api/events', {
      method: 'POST', cookie, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ creator_name: 'Organizer', name: 'Invalid', date: '2026-10-28', ...extras }),
    })).status, 400);
  }

  const create = await request('/api/events', {
    method: 'POST', cookie, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ creator_name: '  QA Organizer  ', name: 'Brand QA', date: '2026-10-28', start_time: '18:30', location: '  Room A  ' }),
  });
  assert.equal(create.status, 201);
  const { id, creator_name: creatorName, start_time: startTime, location, check_in_open: isOpen } = await create.json();
  assert.ok(id);
  assert.equal(creatorName, 'QA Organizer');
  assert.equal(startTime, '18:30');
  assert.equal(location, 'Room A');
  assert.equal(isOpen, 1);
  const minimalCreate = await request('/api/events', {
    method: 'POST', cookie, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ creator_name: 'Organizer', name: 'No Time or Location', date: '2026-10-28' }),
  });
  assert.equal(minimalCreate.status, 201);
  const minimal = await minimalCreate.json();
  assert.equal(minimal.start_time, null);
  assert.equal(minimal.location, null);
  assert.equal(minimal.check_in_open, 1);
  assert.equal((await request(`/api/events/${minimal.id}`, { method: 'DELETE', cookie })).status, 200);
  const bulkCreate = await request('/api/events', {
    method: 'POST', cookie, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ creator_name: 'Organizer', name: 'Old Attendee Batch', date: '2026-10-28' }),
  });
  assert.equal(bulkCreate.status, 201);
  const bulkId = (await bulkCreate.json()).id;
  const bulkDb = createClient({ url: `file:${join(dir, 'events.db')}` });
  await bulkDb.batch(Array.from({ length: 251 }, (_, index) => ({
    sql: 'INSERT INTO attendees (id, event_id, first_name, last_name) VALUES (?, ?, ?, ?)',
    args: [randomUUID(), bulkId, `Old${index}`, 'Attendee'],
  })), 'write');
  bulkDb.close();
  const firstBulkAttempt = await request(`/api/events/${bulkId}/attend`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ first_name: 'New', last_name: 'Arrival' }),
  });
  assert.equal(firstBulkAttempt.status, 503);
  assert.equal((await firstBulkAttempt.json()).code, 'CHECK_IN_PREPARING');
  assert.equal((await request(`/api/events/${bulkId}`, {
    method: 'PATCH', cookie, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ check_in_open: false }),
  })).status, 200);
  const closedBulkAttempt = await request(`/api/events/${bulkId}/attend`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ first_name: 'New', last_name: 'Arrival' }),
  });
  assert.equal(closedBulkAttempt.status, 403);
  assert.equal((await closedBulkAttempt.json()).code, 'CHECK_IN_CLOSED');
  assert.equal((await request(`/api/events/${bulkId}`, {
    method: 'PATCH', cookie, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ check_in_open: true }),
  })).status, 200);
  const secondBulkAttempts = await Promise.all(Array.from({ length: 5 }, (_, index) => request(`/api/events/${bulkId}/attend`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ first_name: `New${index}`, last_name: 'Arrival' }),
  })));
  assert.deepEqual(secondBulkAttempts.map((response) => response.status), Array(5).fill(201));
  assert.equal((await (await request(`/api/events/${bulkId}`, { cookie })).json()).attendees.length, 256);
  assert.equal((await request(`/api/events/${bulkId}`, { method: 'DELETE', cookie })).status, 200);
  const rushCreate = await request('/api/events', {
    method: 'POST', cookie, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ creator_name: 'Organizer', name: 'Arrival Rush', date: '2026-10-28' }),
  });
  assert.equal(rushCreate.status, 201);
  const rushId = (await rushCreate.json()).id;
  const rush = await Promise.all(Array.from({ length: 12 }, (_, index) => request(`/api/events/${rushId}/attend`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ first_name: `Person${index}`, last_name: 'Rush' }),
  })));
  assert.deepEqual(rush.map((response) => response.status), Array(12).fill(201));
  assert.equal((await (await request(`/api/events/${rushId}`, { cookie })).json()).attendees.length, 12);
  assert.equal((await request(`/api/events/${rushId}`, { method: 'DELETE', cookie })).status, 200);
  const updatedList = await request('/api/events', { cookie });
  const listed = (await updatedList.json()).find((event) => event.id === id);
  assert.equal(listed.creator_name, 'QA Organizer');
  assert.equal(listed.location, 'Room A');
  assert.equal(listed.check_in_open, 1);
  assert.equal((await request(`/admin/events/${id}`)).status, 200);
  const protectedPoster = await request(`/admin/events/${id}/poster`, { redirect: 'manual' });
  assert.equal(protectedPoster.status, 307);
  assert.equal(protectedPoster.headers.get('location'), '/admin');
  const poster = await request(`/admin/events/${id}/poster`, { cookie });
  assert.equal(poster.status, 200);
  const posterHtml = await poster.text();
  assert.match(posterHtml, /Brand QA/);
  assert.match(posterHtml, /October 28, 2026/);
  assert.match(posterHtml, /EPAM EVENTS/);
  assert.match(posterHtml, /Print \/ Save PDF/);
  assert.match(posterHtml, /epam-logo\.svg/);
  assert.match(posterHtml, /18:30/);
  assert.match(posterHtml, /Room A/);
  assert.doesNotMatch(posterHtml, /QA Organizer|Public Person|Manual Person/);
  const cssPaths = [...posterHtml.matchAll(/href="([^"]+\.css[^"]*)"/g)].map((match) => match[1]);
  assert.ok(cssPaths.length > 0);
  const styleSheets = await Promise.all(cssPaths.map(async (path) => (await request(path)).text()));
  assert.ok(styleSheets.some((css) => /@page/.test(css) && /A4/i.test(css) && /poster-controls/.test(css)));
  assert.equal((await request(`/admin/events/not-a-real-event/poster`, { cookie })).status, 404);
  assert.equal((await request(`/attend/${id}`)).status, 200);
  assert.equal((await request(`/api/events/${id}`)).status, 401);
  assert.equal((await request(`/api/events/${id}/export`)).status, 401);

  const publicBefore = await request(`/api/events/${id}/public`);
  assert.equal(publicBefore.status, 200);
  const publicFields = { name: 'Brand QA', date: '2026-10-28', start_time: '18:30', location: 'Room A', check_in_open: 1 };
  assert.deepEqual(await publicBefore.json(), { event: publicFields });
  const checkin = await request(`/api/events/${id}/attend`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ first_name: 'Public', last_name: 'Person' }),
  });
  assert.equal(checkin.status, 201);
  const publicAfter = await request(`/api/events/${id}/public`);
  assert.equal(publicAfter.status, 200);
  assert.deepEqual(await publicAfter.json(), { event: publicFields });

  const duplicate = await request(`/api/events/${id}/attend`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ first_name: '  pUbLiC  ', last_name: ' PERSON ' }),
  });
  assert.equal(duplicate.status, 409);
  const warning = await duplicate.json();
  assert.equal(warning.code, 'DUPLICATE_NAME');
  assert.doesNotMatch(JSON.stringify(warning), /registered_at|event_id|Public Person/);
  assert.equal((await (await request(`/api/events/${id}`, { cookie })).json()).attendees.length, 1);
  const confirmed = await request(`/api/events/${id}/attend`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ first_name: ' pUbLiC ', last_name: ' PERSON ', confirm_duplicate: true }),
  });
  assert.equal(confirmed.status, 201);

  const manual = await request(`/api/events/${id}/attendees`, {
    method: 'POST', cookie, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ first_name: 'Manual', last_name: 'Person' }),
  });
  assert.equal(manual.status, 201);
  const attendee = await manual.json();
  assert.equal((await request(`/api/events/${id}/attend`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ first_name: 'MANUAL', last_name: 'person' }),
  })).status, 409);
  assert.equal((await request(`/api/events/${id}/attendees`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ first_name: 'No', last_name: 'Access' }),
  })).status, 401);
  const details = await request(`/api/events/${id}`, { cookie });
  assert.equal(details.status, 200);
  const detailData = await details.json();
  assert.equal(detailData.event.creator_name, 'QA Organizer');
  assert.equal(detailData.attendees.length, 3);
  const posterAfterCheckin = await request(`/admin/events/${id}/poster`, { cookie });
  assert.equal(posterAfterCheckin.status, 200);
  assert.doesNotMatch(await posterAfterCheckin.text(), /Public Person|Manual Person|QA Organizer/);

  const edit = await request(`/api/events/${id}`, {
    method: 'PUT', cookie, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Brand QA Updated', date: '2026-10-29' }),
  });
  assert.equal(edit.status, 200);
  const edited = await edit.json();
  assert.equal(edited.name, 'Brand QA Updated');
  assert.equal(edited.creator_name, 'QA Organizer');
  assert.equal(edited.start_time, '18:30');
  assert.equal(edited.location, 'Room A');
  assert.equal((await request(`/api/events/${id}`, {
    method: 'PUT', cookie, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Brand QA Updated', date: '2026-10-29', start_time: '99:30', location: 'Room A' }),
  })).status, 400);
  assert.deepEqual(await (await request(`/api/events/${id}/public`)).json(), {
    event: { ...publicFields, name: 'Brand QA Updated', date: '2026-10-29' },
  });
  assert.equal((await request(`/api/events/${id}`, { method: 'DELETE' })).status, 401);
  assert.equal((await request(`/api/events/${id}/attendees/${attendee.id}`, { method: 'DELETE' })).status, 401);
  assert.equal((await request(`/api/events/${id}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ check_in_open: false }),
  })).status, 401);
  assert.equal((await request(`/api/events/${id}`, {
    method: 'PATCH', cookie, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ check_in_open: 'false' }),
  })).status, 400);
  const close = await request(`/api/events/${id}`, {
    method: 'PATCH', cookie, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ check_in_open: false }),
  });
  assert.equal(close.status, 200);
  assert.equal((await close.json()).check_in_open, 0);
  assert.equal((await (await request(`/api/events/${id}/public`)).json()).event.check_in_open, 0);
  const closedPoster = await request(`/admin/events/${id}/poster`, { cookie });
  assert.equal(closedPoster.status, 200);
  assert.match(await closedPoster.text(), /Check-in is closed/);
  const closedCheckin = await request(`/api/events/${id}/attend`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ first_name: 'Public', last_name: 'Person', confirm_duplicate: true }),
  });
  assert.equal(closedCheckin.status, 403);
  assert.equal((await closedCheckin.json()).code, 'CHECK_IN_CLOSED');
  assert.equal((await (await request(`/api/events/${id}`, { cookie })).json()).attendees.length, 3);
  const adminDuringClose = await request(`/api/events/${id}/attendees`, {
    method: 'POST', cookie, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ first_name: 'Closed', last_name: 'Manual' }),
  });
  assert.equal(adminDuringClose.status, 201);
  assert.equal((await (await request(`/api/events/${id}/public`)).json()).event.check_in_open, 0);
  const reopen = await request(`/api/events/${id}`, {
    method: 'PATCH', cookie, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ check_in_open: true }),
  });
  assert.equal(reopen.status, 200);
  assert.equal((await reopen.json()).check_in_open, 1);
  assert.match(await (await request(`/admin/events/${id}/poster`, { cookie })).text(), /Scan to check in/);
  assert.equal((await request(`/api/events/${id}/attend`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ first_name: 'After', last_name: 'Reopen' }),
  })).status, 201);
  assert.equal((await (await request(`/api/events/${id}`, { cookie })).json()).attendees.length, 5);

  const excel = await request(`/api/events/${id}/export`, { cookie });
  assert.equal(excel.status, 200);
  assert.match(excel.headers.get('content-type'), /spreadsheetml\.sheet/);
  const bytes = new Uint8Array(await excel.arrayBuffer());
  assert.equal(String.fromCharCode(...bytes.slice(0, 2)), 'PK');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes));
  const sheet = workbook.getWorksheet('Attendees');
  assert.equal(sheet.getRow(4).getCell(2).value, 'First Name');
  assert.equal(sheet.getRow(5).getCell(2).value, 'Public');
  assert.doesNotMatch(JSON.stringify(sheet.getSheetValues()), /QA Organizer|Created by|Room A|18:30/);

  const clearDetails = await request(`/api/events/${id}`, {
    method: 'PUT', cookie, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Brand QA Updated', date: '2026-10-29', start_time: '', location: null }),
  });
  assert.equal(clearDetails.status, 200);
  assert.equal((await clearDetails.json()).start_time, null);
  assert.deepEqual(await (await request(`/api/events/${id}/public`)).json(), {
    event: { ...publicFields, name: 'Brand QA Updated', date: '2026-10-29', start_time: null, location: null },
  });

  assert.equal((await request(`/api/events/${id}/attendees/${attendee.id}`, { method: 'DELETE', cookie })).status, 200);
  const remaining = await request(`/api/events/${id}`, { cookie });
  assert.equal((await remaining.json()).attendees.length, 4);

  const raceCreate = await request('/api/events', {
    method: 'POST', cookie, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ creator_name: 'Organizer', name: 'Race Event', date: '2026-10-28' }),
  });
  const raceId = (await raceCreate.json()).id;
  assert.equal(raceCreate.status, 201);
  const [raceDelete, racePublic, raceManual] = await Promise.all([
    request(`/api/events/${raceId}`, { method: 'DELETE', cookie }),
    request(`/api/events/${raceId}/attend`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ first_name: 'Public', last_name: 'Race' }),
    }),
    request(`/api/events/${raceId}/attendees`, {
      method: 'POST', cookie, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ first_name: 'Manual', last_name: 'Race' }),
    }),
  ]);
  assert.equal(raceDelete.status, 200);
  assert.ok([201, 404].includes(racePublic.status));
  assert.ok([201, 404].includes(raceManual.status));
  const afterRace = createClient({ url: `file:${join(dir, 'events.db')}` });
  assert.equal(Number((await afterRace.execute({ sql: 'SELECT COUNT(*) AS count FROM attendees WHERE event_id = ?', args: [raceId] })).rows[0].count), 0);
  assert.equal(Number((await afterRace.execute({ sql: 'SELECT COUNT(*) AS count FROM events WHERE id = ?', args: [raceId] })).rows[0].count), 0);
  afterRace.close();

  assert.equal((await request(`/api/events/${id}`, { method: 'DELETE', cookie })).status, 200);
  assert.equal((await request(`/api/events/${id}/public`)).status, 404);
  assert.equal((await request(`/api/events/${legacyId}`, { cookie })).status, 200);

  const logout = await request('/api/auth', { method: 'DELETE', cookie });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i);
});
