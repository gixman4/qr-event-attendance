import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendCheckInWithRetry } from '../lib/check-in-request.mts';

const payload = { first_name: 'Ana', last_name: 'Morgan', confirm_duplicate: false };
const preparing = () => Response.json({ code: 'CHECK_IN_PREPARING', error: 'Preparing.' }, { status: 503 });

test('retries preparation without changing the submitted name', async () => {
  const controller = new AbortController();
  const submitted = [];
  let notices = 0;
  const response = await sendCheckInWithRetry('/api/events/test/attend', payload, {
    signal: controller.signal,
    delayMs: 0,
    onPreparing: () => { notices++; },
    request: async (_url, options) => {
      submitted.push(JSON.parse(options.body));
      return submitted.length < 3 ? preparing() : Response.json({ success: true }, { status: 201 });
    },
  });
  assert.equal(response.status, 201);
  assert.equal(notices, 2);
  assert.deepEqual(submitted, [payload, payload, payload]);
});

test('does not retry duplicate, closed, or unrelated errors', async () => {
  for (const status of [409, 403, 500, 503]) {
    let calls = 0;
    const response = await sendCheckInWithRetry('/api/events/test/attend', payload, {
      signal: new AbortController().signal,
      onPreparing: () => { throw new Error('Unexpected retry'); },
      request: async () => {
        calls++;
        return Response.json({ code: 'OTHER_ERROR' }, { status });
      },
    });
    assert.equal(response.status, status);
    assert.equal(calls, 1);
  }
});

test('limits retries and returns a helpful error when migration remains incomplete', async () => {
  let calls = 0;
  const response = await sendCheckInWithRetry('/api/events/test/attend', payload, {
    signal: new AbortController().signal,
    maxAttempts: 3,
    delayMs: 0,
    onPreparing: () => {},
    request: async () => { calls++; return preparing(); },
  });
  assert.equal(calls, 3);
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /try again shortly/i);
});

test('aborts during the pause without sending another check-in', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(
    sendCheckInWithRetry('/api/events/test/attend', payload, {
      signal: controller.signal,
      onPreparing: () => { controller.abort(); },
      request: async () => { calls++; return preparing(); },
    }),
    { name: 'AbortError' },
  );
  assert.equal(calls, 1);
});

test('does not show preparation after cancellation during response parsing', async () => {
  const controller = new AbortController();
  let release;
  let notices = 0;
  const response = new Response(new ReadableStream({
    start(stream) {
      release = () => {
        stream.enqueue(new TextEncoder().encode(JSON.stringify({ code: 'CHECK_IN_PREPARING' })));
        stream.close();
      };
    },
  }), { status: 503 });
  const pending = sendCheckInWithRetry('/api/events/test/attend', payload, {
    signal: controller.signal,
    onPreparing: () => { notices++; },
    request: async () => response,
  });
  controller.abort();
  release();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(notices, 0);
});
