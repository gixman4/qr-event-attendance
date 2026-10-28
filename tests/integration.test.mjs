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
  assert.equal((await legacyList.json()).find((event) => event.id === legacyId).creator_name, null);
  const legacyDetails = await request(`/api/events/${legacyId}`, { cookie });
  assert.equal(legacyDetails.status, 200);
  assert.equal((await legacyDetails.json()).event.creator_name, null);
  // Initializing the schema repeatedly must not lose existing events.
  assert.equal((await request('/api/events', { cookie })).status, 200);

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

  const create = await request('/api/events', {
    method: 'POST', cookie, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ creator_name: '  QA Organizer  ', name: 'Brand QA', date: '2026-10-28' }),
  });
  assert.equal(create.status, 201);
  const { id, creator_name: creatorName } = await create.json();
  assert.ok(id);
  assert.equal(creatorName, 'QA Organizer');
  const updatedList = await request('/api/events', { cookie });
  assert.equal((await updatedList.json()).find((event) => event.id === id).creator_name, 'QA Organizer');
  assert.equal((await request(`/admin/events/${id}`)).status, 200);
  assert.equal((await request(`/attend/${id}`)).status, 200);
  assert.equal((await request(`/api/events/${id}`)).status, 401);
  assert.equal((await request(`/api/events/${id}/export`)).status, 401);

  const publicBefore = await request(`/api/events/${id}/public`);
  assert.equal(publicBefore.status, 200);
  assert.deepEqual(await publicBefore.json(), { event: { name: 'Brand QA', date: '2026-10-28' } });
  const checkin = await request(`/api/events/${id}/attend`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ first_name: 'Public', last_name: 'Person' }),
  });
  assert.equal(checkin.status, 201);
  const publicAfter = await request(`/api/events/${id}/public`);
  assert.equal(publicAfter.status, 200);
  assert.deepEqual(await publicAfter.json(), { event: { name: 'Brand QA', date: '2026-10-28' } });

  const manual = await request(`/api/events/${id}/attendees`, {
    method: 'POST', cookie, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ first_name: 'Manual', last_name: 'Person' }),
  });
  assert.equal(manual.status, 201);
  const attendee = await manual.json();
  assert.equal((await request(`/api/events/${id}/attendees`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ first_name: 'No', last_name: 'Access' }),
  })).status, 401);
  const details = await request(`/api/events/${id}`, { cookie });
  assert.equal(details.status, 200);
  const detailData = await details.json();
  assert.equal(detailData.event.creator_name, 'QA Organizer');
  assert.equal(detailData.attendees.length, 2);

  const edit = await request(`/api/events/${id}`, {
    method: 'PUT', cookie, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Brand QA Updated', date: '2026-10-29' }),
  });
  assert.equal(edit.status, 200);
  const edited = await edit.json();
  assert.equal(edited.name, 'Brand QA Updated');
  assert.equal(edited.creator_name, 'QA Organizer');
  assert.deepEqual(await (await request(`/api/events/${id}/public`)).json(), {
    event: { name: 'Brand QA Updated', date: '2026-10-29' },
  });
  assert.equal((await request(`/api/events/${id}`, { method: 'DELETE' })).status, 401);
  assert.equal((await request(`/api/events/${id}/attendees/${attendee.id}`, { method: 'DELETE' })).status, 401);

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
  assert.doesNotMatch(JSON.stringify(sheet.getSheetValues()), /QA Organizer|Created by/);

  assert.equal((await request(`/api/events/${id}/attendees/${attendee.id}`, { method: 'DELETE', cookie })).status, 200);
  const remaining = await request(`/api/events/${id}`, { cookie });
  assert.equal((await remaining.json()).attendees.length, 1);
  assert.equal((await request(`/api/events/${id}`, { method: 'DELETE', cookie })).status, 200);
  assert.equal((await request(`/api/events/${id}/public`)).status, 404);
  assert.equal((await request(`/api/events/${legacyId}`, { cookie })).status, 200);

  const logout = await request('/api/auth', { method: 'DELETE', cookie });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i);
});
