import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { startVisiblePolling } from '../lib/visible-polling.mts';

class FakePage extends EventTarget {
  hidden = false;

  setHidden(hidden) {
    this.hidden = hidden;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

async function waitFor(predicate) {
  for (let i = 0; i < 200; i++) {
    if (predicate()) return;
    await delay(5);
  }
  assert.fail('Timed out waiting for scheduled refresh');
}

test('polls while visible, pauses in the background and resumes immediately', async (t) => {
  const page = new FakePage();
  let calls = 0;
  const stop = startVisiblePolling(async () => { calls++; }, 20, page);
  t.after(stop);

  await waitFor(() => calls >= 1);
  page.setHidden(true);
  const beforePause = calls;
  await delay(75);
  assert.equal(calls, beforePause);

  page.setHidden(false);
  await waitFor(() => calls > beforePause);
  stop();
  const beforeStop = calls;
  await delay(75);
  assert.equal(calls, beforeStop);
  page.setHidden(true);
  page.setHidden(false);
  assert.equal(calls, beforeStop);
});

test('waits for each response and retries after a failed request', async (t) => {
  const page = new FakePage();
  let calls = 0;
  let active = 0;
  let maximumActive = 0;
  const stop = startVisiblePolling(async () => {
    calls++;
    active++;
    maximumActive = Math.max(maximumActive, active);
    await delay(35);
    active--;
    if (calls === 1) throw new Error('Temporary network error');
  }, 10, page);
  t.after(stop);

  await waitFor(() => calls >= 3);
  assert.equal(maximumActive, 1);
});

test('aborts outstanding requests when hidden or unmounted', async (t) => {
  const page = new FakePage();
  let started = 0;
  let aborted = 0;
  const stop = startVisiblePolling((signal) => new Promise((_resolve, reject) => {
    started++;
    signal.addEventListener('abort', () => {
      aborted++;
      reject(new Error('Aborted'));
    }, { once: true });
  }), 10, page);
  t.after(stop);

  await waitFor(() => started === 1);
  page.setHidden(true);
  assert.equal(aborted, 1);
  page.setHidden(false);
  await waitFor(() => started === 2);
  stop();
  assert.equal(aborted, 2);
  await delay(30);
  assert.equal(started, 2);
});

test('does not start a timer in an initially hidden tab', async (t) => {
  const page = new FakePage();
  page.hidden = true;
  let calls = 0;
  const stop = startVisiblePolling(async () => { calls++; }, 10, page);
  t.after(stop);
  await delay(40);
  assert.equal(calls, 0);
  page.setHidden(false);
  await waitFor(() => calls === 1);
});
