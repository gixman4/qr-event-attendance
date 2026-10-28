import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const chromePath = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function availablePort() {
  const socket = createServer();
  await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

test('headless browser completes check-in, duplicate warning, closed view and admin searches', {
  skip: !existsSync(chromePath) && 'Set CHROME_BIN to run this optional test',
  timeout: 60_000,
}, async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'epam-browser-'));
  const port = await availablePort();
  const debugPort = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  const password = `browser-test-${randomUUID()}`;
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TURSO_DATABASE_URL: `file:${join(dir, 'events.db')}`,
      TURSO_AUTH_TOKEN: '',
      ADMIN_PASSWORD_HASH: '',
      ADMIN_PASSWORD: password,
      SESSION_SECRET: `browser-test-${randomUUID()}-${randomUUID()}`,
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  server.stdout.on('data', (chunk) => { serverLog += String(chunk); });
  server.stderr.on('data', (chunk) => { serverLog += String(chunk); });
  const chrome = spawn(chromePath, [
    '--headless', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--disable-background-networking', '--remote-allow-origins=*',
    `--user-data-dir=${join(dir, 'chrome-profile')}`,
    `--remote-debugging-port=${debugPort}`, 'about:blank',
  ], { stdio: 'ignore' });
  let websocket;
  t.after(async () => {
    websocket?.close();
    const stop = async (child) => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.kill('SIGTERM');
      await Promise.race([exited, delay(3_000)]);
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      await Promise.race([exited, delay(2_000)]);
    };
    await Promise.all([stop(chrome), stop(server)]);
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await rm(dir, { recursive: true, force: true });
        break;
      } catch (error) {
        if (attempt === 9) throw error;
        await delay(150);
      }
    }
  });

  async function waitFor(check, label) {
    for (let i = 0; i < 100; i++) {
      try {
        const result = await check();
        if (result) return result;
      } catch { /* Browser or page is still starting. */ }
      await delay(100);
    }
    assert.fail(`Timed out waiting for ${label}. Server log: ${serverLog}`);
  }

  await waitFor(async () => (await fetch(`${origin}/`)).ok, 'Next.js server');
  const login = await fetch(`${origin}/api/auth`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const created = await fetch(`${origin}/api/events`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ creator_name: 'Browser Organizer', name: 'Browser Check-in', date: '2026-10-28', start_time: '14:30', location: 'Room B' }),
  });
  assert.equal(created.status, 201);
  const { id } = await created.json();

  const targets = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    return (await response.json()).find((target) => target.type === 'page')?.webSocketDebuggerUrl;
  }, 'Chrome DevTools target');
  websocket = new WebSocket(targets);
  await new Promise((resolve, reject) => {
    websocket.addEventListener('open', resolve, { once: true });
    websocket.addEventListener('error', reject, { once: true });
  });
  let commandId = 0;
  const waiting = new Map();
  websocket.addEventListener('message', (event) => {
    const response = JSON.parse(event.data);
    const pending = waiting.get(response.id);
    if (!pending) return;
    waiting.delete(response.id);
    if (response.error) pending.reject(new Error(response.error.message));
    else pending.resolve(response.result);
  });
  function cdp(method, params = {}) {
    const id = ++commandId;
    return new Promise((resolve, reject) => {
      waiting.set(id, { resolve, reject });
      websocket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const response = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
    return response.result.value;
  }
  async function navigate(path) {
    await cdp('Page.navigate', { url: `${origin}${path}` });
  }
  async function visible(text) {
    try {
      return await waitFor(async () => {
        const content = await evaluate('document.body?.innerText ?? ""');
        return content.toLocaleLowerCase().includes(text.toLocaleLowerCase()) && content;
      }, `page text: ${text}`);
    } catch (error) {
      const snapshot = await evaluate('({text: document.body?.innerText, inputs: [...document.querySelectorAll("input")].map(el => ({value:el.value,valid:el.checkValidity()}))})');
      throw new Error(`${error.message}\nBrowser snapshot: ${JSON.stringify(snapshot)}`);
    }
  }
  async function fill(selector, value) {
    const expression = `(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return input.value;
    })()`;
    assert.equal(await evaluate(expression), value);
    await delay(50);
  }

  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await navigate(`/attend/${id}`);
  const formText = await visible('Enter your name to register attendance');
  assert.match(formText, /Browser Check-in/);
  assert.match(formText, /14:30/);
  assert.match(formText, /Room B/);
  await fill('input[autocomplete="given-name"]', 'Ana');
  await fill('input[autocomplete="family-name"]', 'Morgan');
  await evaluate('document.querySelector("button[type=submit]").click()');
  await visible('Check-in Successful');

  await navigate(`/attend/${id}`);
  await visible('Enter your name to register attendance');
  await fill('input[autocomplete="given-name"]', 'Ana');
  await fill('input[autocomplete="family-name"]', 'Morgan');
  await evaluate('document.querySelector("button[type=submit]").click()');
  await visible('Someone with this name has already checked in');
  await evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.includes("Check in anyway")).click()');
  await visible('Check-in Successful');

  const details = await fetch(`${origin}/api/events/${id}`, { headers: { cookie } });
  assert.equal((await details.json()).attendees.length, 2);
  const close = await fetch(`${origin}/api/events/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ check_in_open: false }),
  });
  assert.equal(close.status, 200);
  await navigate(`/attend/${id}`);
  await visible('Check-in is closed');
  assert.equal(await evaluate('document.querySelector("button[type=submit]") === null'), true);

  const reopen = await fetch(`${origin}/api/events/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ check_in_open: true }),
  });
  assert.equal(reopen.status, 200);

  let pausedCheckIn;
  const onPaused = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Fetch.requestPaused') pausedCheckIn = message.params;
  };
  websocket.addEventListener('message', onPaused);
  await cdp('Fetch.enable', { patterns: [{ urlPattern: `*api/events/${id}/attend*`, requestStage: 'Response' }] });
  await navigate(`/attend/${id}`);
  await visible('Enter your name to register attendance');
  await fill('input[autocomplete="given-name"]', 'Delayed');
  await fill('input[autocomplete="family-name"]', 'Success');
  await evaluate('document.querySelector("button[type=submit]").click()');
  await waitFor(() => pausedCheckIn?.responseStatusCode === 201, 'committed check-in response held by Chrome');
  assert.equal((await (await fetch(`${origin}/api/events/${id}`, { headers: { cookie } })).json()).attendees.length, 3);
  assert.equal((await fetch(`${origin}/api/events/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ check_in_open: false }),
  })).status, 200);
  await delay(5_500);
  const stillSubmitting = await evaluate('document.body.innerText');
  assert.match(stillSubmitting, /Checking in/i);
  assert.doesNotMatch(stillSubmitting, /Check-in is closed/i);
  await cdp('Fetch.continueResponse', { requestId: pausedCheckIn.requestId });
  await visible('Check-in Successful');
  await cdp('Fetch.disable');
  websocket.removeEventListener('message', onPaused);

  await cdp('Network.enable');
  assert.equal((await cdp('Network.setCookie', {
    name: 'qr_admin_session', value: cookie.split('=')[1], url: origin,
    httpOnly: true, secure: false, sameSite: 'Lax',
  })).success, true);
  await navigate('/admin');
  await visible('Browser Check-in');
  await fill('#event-search', 'Not an event');
  await visible('No events match your search');
  await fill('#event-search', 'Room B');
  await visible('Browser Check-in');
  await navigate(`/admin/events/${id}`);
  await visible('Search attendees');
  await fill('#attendee-search', 'No attendee');
  await visible('No attendees match your search');
  await fill('#attendee-search', 'Ana');
  await visible('Ana Morgan');

  await evaluate(`document.querySelector('button[aria-label="Edit event"]').click()`);
  await visible('Edit Event');
  await fill('#edit-time', '15:45');
  await fill('#edit-location', 'Room C');
  await evaluate('document.querySelector("#edit-time").closest("form").querySelector("button[type=submit]").click()');
  await visible('Time: 15:45');
  await visible('Location: Room C');
  const publicEdited = await fetch(`${origin}/api/events/${id}/public`);
  assert.equal((await publicEdited.json()).event.start_time, '15:45');

  await evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.includes("Reopen check-in")).click()');
  await visible('Check-in open');
  await evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.includes("Close check-in")).click()');
  await visible('New QR check-ins will stop immediately');
  await evaluate('[...document.querySelectorAll("button")].filter(button => button.textContent.trim() === "Close check-in").at(-1).click()');
  await visible('Check-in closed');
  assert.equal((await (await fetch(`${origin}/api/events/${id}/public`)).json()).event.check_in_open, 0);

  await navigate('/admin/create');
  await visible('Create New Event');
  await fill('#creator-name', 'Browser Creator');
  await fill('input[placeholder="e.g. Q3 All Hands"]', 'Created in Chrome');
  await fill('#event-time', '16:15');
  await fill('#event-location', 'Room D');
  await evaluate('document.querySelector("button[type=submit]").click()');
  await visible('Created in Chrome');
  await visible('Created by Browser Creator');
  const listing = await fetch(`${origin}/api/events`, { headers: { cookie } });
  const chromeCreated = (await listing.json()).find((item) => item.name === 'Created in Chrome');
  assert.equal(chromeCreated.start_time, '16:15');
  assert.equal(chromeCreated.location, 'Room D');

  await cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  for (const [path, expected] of [
    ['/admin', 'Browser Check-in'],
    ['/admin/create', 'Create New Event'],
    [`/admin/events/${id}`, 'Search attendees'],
    [`/attend/${chromeCreated.id}`, 'Enter your name to register attendance'],
    [`/admin/events/${chromeCreated.id}/poster`, 'Print / Save PDF'],
  ]) {
    await navigate(path);
    await visible(expected);
    const widths = await evaluate('({ viewport: window.innerWidth, page: document.documentElement.scrollWidth })');
    assert.ok(widths.page <= widths.viewport + 1, `${path} overflows on mobile: ${JSON.stringify(widths)}`);
  }

  await cdp('Emulation.clearDeviceMetricsOverride');
  await navigate(`/admin/events/${chromeCreated.id}/poster`);
  await visible('Print / Save PDF');
  await waitFor(() => evaluate('document.querySelector(".poster-qr-image")?.complete && document.querySelector(".poster-qr-image")?.naturalWidth > 0'), 'poster QR image');
  const pdf = Buffer.from((await cdp('Page.printToPDF', { printBackground: true, preferCSSPageSize: true })).data, 'base64');
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length, 1, 'A4 poster should print on one page');
});
