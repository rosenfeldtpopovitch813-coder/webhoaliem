import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRoute, ROUTES } from '../src/core/router.js';
import { normalizeTheme } from '../src/core/theme.js';
import { ReactiveStore } from '../src/core/store.js';
import { MonotonicClock } from '../src/core/clock.js';
import fs from 'node:fs';

test('SPA routes and protected views', () => {
  assert.equal(resolveRoute('/', 'student', false).status, 200);
  assert.equal(resolveRoute('/admin', 'student', true).status, 403);
  assert.equal(resolveRoute('/admin', 'admin', false).status, 403);
  assert.equal(resolveRoute('/admin', 'admin', true).status, 200);
  assert.equal(resolveRoute('/chemmaker', 'teacher', true).status, 200);
  assert.equal(resolveRoute('/missing').status, 404);
  assert.equal(Object.keys(ROUTES).length, 9);
  assert.equal(resolveRoute('/admissions', 'student', false).module, 'admissions');
  assert.equal(resolveRoute('/community', 'student', false).module, 'community-ai');
});
test('Themes use strict allowlist', () => {
  assert.equal(normalizeTheme('midnight'), 'midnight');
  assert.equal(normalizeTheme('fake'), 'aurora');
  assert.equal(normalizeTheme('__proto__'), 'aurora');
});
test('Store tolerates self-unsubscribe during notify', () => {
  const store = new ReactiveStore({ x: 0 });
  let calls = 0;
  const stop = store.subscribe('x', () => { calls++; stop(); });
  store.set('x', 1); store.set('x', 2);
  assert.equal(calls, 1);
});
test('Clock rejects invalid server time without becoming synced', async () => {
  const clock = new MonotonicClock();
  const previous = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await clock.syncWithServer(async () => ({ ok: true, json: async () => ({ serverTime: 'not-a-number' }) })), false);
    assert.equal(clock.isSynced, false);
  } finally { console.warn = previous; }
});
test('Database rules do not allow direct client arena modification or answer reads', () => {
  const rules = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url)));
  assert.equal(rules.rules.arena_rooms['.write'], false);
  assert.equal(rules.rules.exams_answers['.read'], false);
  assert.equal(rules.rules.exams_answers['.write'], false);
  assert.equal(rules.rules.users.$uid.stats['.write'], false);
  assert.equal(rules.rules.server_rate_limits['.read'], false);
  assert.equal(rules.rules.server_rate_limits['.write'], false);
});
