// Ratchet: hard-coded hex colours in pages may only go down. Use the tokens in src/index.css instead
// (var(--accent), var(--green), …). When you migrate a page, lower its number in design-baseline.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pages = join(here, '../pages');
const baseline = JSON.parse(readFileSync(join(here, 'design-baseline.json'), 'utf8'));
const count = (file) => (readFileSync(join(pages, file), 'utf8').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []).length;

test('pages do not add hard-coded hex colours (use design tokens)', () => {
  for (const file of readdirSync(pages).filter(f => f.endsWith('.jsx'))) {
    const allowed = baseline[file] ?? 0;
    assert.ok(count(file) <= allowed, `${file} has ${count(file)} hex colours, baseline allows ${allowed}. Use var(--token) from index.css.`);
  }
});

test('baseline is kept tight: lower design-baseline.json when a page improves', () => {
  for (const [file, allowed] of Object.entries(baseline)) {
    assert.ok(count(file) >= allowed, `${file} now has ${count(file)} hex colours but the baseline says ${allowed}. Lower it in design-baseline.json.`);
  }
});
