// Drift guard: every event in the catalogue must actually be fired somewhere in the app,
// and the app must not fire an event name that isn't in the catalogue.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EVENTS } from './analyticsEvents.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = (dir) => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  if (statSync(p).isDirectory()) return files(p);
  return /\.(jsx?|mjs)$/.test(f) && !/\.test\.mjs$/.test(f) && !p.endsWith('analyticsEvents.js') ? [p] : [];
});
const source = files(SRC).map(p => readFileSync(p, 'utf8')).join('\n');

test('every catalogue event is fired from somewhere', () => {
  const missing = Object.keys(EVENTS).filter(name => !new RegExp(`['"]${name}['"]`).test(source));
  assert.deepEqual(missing, []);
});

test('the app never tracks an event that is not in the catalogue', () => {
  const used = [...source.matchAll(/\btrack(?:Then)?\(\s*['"]([a-z_]+)['"]/g)].map(m => m[1]);
  const unknown = [...new Set(used)].filter(n => !EVENTS[n]);
  assert.deepEqual(unknown, []);
});
