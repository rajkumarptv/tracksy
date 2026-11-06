// Guardrail: the colour tokens in index.css must keep meeting WCAG AA for text (4.5:1).
// It reads the real tokens, so changing a colour in the CSS without checking contrast fails here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../index.css'), 'utf8');

const block = (startPattern) => {
  const start = css.search(startPattern);
  assert.ok(start >= 0, `block not found: ${startPattern}`);
  const open = css.indexOf('{', start);
  let depth = 0, i = open;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) break;
  }
  return css.slice(open + 1, i);
};

const tokens = body => Object.fromEntries(
  [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));

const light = tokens(block(/:root\s*\{/));
const dark = { ...light, ...tokens(block(/\[data-theme="dark"\]\s*\{/)) };

const parse = v => {
  let m = v.match(/^#([0-9a-f]{6})$/i);
  if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: 1 };
  m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  throw new Error(`cannot parse colour "${v}"`);
};
const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
const lum = ({ r, g, b }) => {
  const [R, G, B] = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [foreground token, background token] — text pairs that really occur in the UI
const PAIRS = [
  ['text', 'surface'], ['text', 'bg'], ['text2', 'surface'], ['text2', 'surface2'],
  ['text3', 'surface'], ['text3', 'bg'], ['text3', 'surface2'],
  ['accent', 'surface'], ['accent', 'accent-light'],
  ['green', 'surface'], ['green', 'green-light'], ['green', 'green-fill'],
  ['red-text', 'surface'], ['red-text', 'red-light'],
  ['orange-text', 'surface'], ['orange-text', 'orange-light'],
  ['blue-text', 'surface'], ['blue-text', 'blue-light'],
];

for (const [name, t] of [['light', light], ['dark', dark]]) {
  test(`${name}: text colours meet WCAG AA (4.5:1)`, () => {
    const failures = [];
    for (const [fg, bg] of PAIRS) {
      if (!t[fg] || !t[bg]) continue;
      const base = parse(t.surface);
      const bgc = over(parse(t[bg]), base);
      const r = ratio(over(parse(t[fg]), bgc), bgc);
      if (r < 4.5) failures.push(`${fg} on ${bg}: ${r.toFixed(2)}`);
    }
    assert.deepEqual(failures, []);
  });

  test(`${name}: white text on the filled button meets AA`, () => {
    const bg = parse(t['accent-btn']);
    assert.ok(ratio({ r: 255, g: 255, b: 255, a: 1 }, bg) >= 4.5);
  });
}

test('semantic colours are distinct: income green is not the expense red or the brand blue', () => {
  for (const t of [light, dark]) {
    assert.notEqual(t.green.toLowerCase(), t.red.toLowerCase());
    assert.notEqual(t.green.toLowerCase(), t.accent.toLowerCase());
    assert.notEqual(t.red.toLowerCase(), t.accent.toLowerCase());
  }
});
