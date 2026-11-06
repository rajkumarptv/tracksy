// Direct GA4 transport: events must reach window.gtag with the same allow-list protection.
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  track, trackThen, pageView, resetPageViewDedupe, setUserContext, clearUserContext, setOptOut, resetApiErrorState, trackApiError,
} from './analytics.js';

const store = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
});

let calls;
beforeEach(() => {
  calls = [];
  globalThis.dataLayer = [];
  globalThis.__TRACKSY_GA__ = 'G-TEST123';
  globalThis.gtag = (...a) => calls.push(a);
  delete globalThis['ga-disable-G-TEST123'];
  store.clear(); resetPageViewDedupe(); resetApiErrorState();
});
afterEach(() => { delete globalThis.__TRACKSY_GA__; delete globalThis.gtag; });

test('track sends the GA4 event with only allow-listed params, and still fills the data layer', () => {
  track('sign_up', { method: 'password', email: 'a@b.com', amount: 500 });
  assert.deepEqual(calls, [['event', 'sign_up', { method: 'password' }]]);
  assert.deepEqual(globalThis.dataLayer, [{ event: 'sign_up', method: 'password' }]);
  assert.ok(!JSON.stringify(calls).includes('@'));
});

test('unknown events never reach gtag', () => {
  track('shared_my_balance', { tx_type: 'income' });
  assert.deepEqual(calls, []);
});

test('page views set a sanitised default location, then send GA4 page_view (query and tokens stripped)', () => {
  pageView('/reset-password', '?token=SECRET&email=a@b.com', 'https://tracksy.example');
  assert.deepEqual(calls, [
    ['set', { page_location: 'https://tracksy.example/reset-password', page_title: 'Reset password' }],
    ['event', 'page_view', { page_location: 'https://tracksy.example/reset-password', page_title: 'Reset password' }],
  ]);
  assert.ok(!JSON.stringify(calls).includes('SECRET'));
});

test('user context sets a hashed user_id and non-identifying properties (no raw id, no email)', async () => {
  await setUserContext({ id: 'user-1234', currency: 'INR', language: 'en', theme: 'dark', email: 'a@b.com' });
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'set');
  assert.match(calls[0][1].user_id, /^[0-9a-f]{64}$/);
  assert.deepEqual(calls[1], ['set', 'user_properties', { user_currency: 'INR', user_language: 'en', platform: 'web', ui_theme: 'dark' }]);
  assert.ok(!JSON.stringify(calls).includes('user-1234') && !JSON.stringify(calls).includes('a@b.com'));
});

test('signing out clears the user id and properties', () => {
  clearUserContext();
  assert.deepEqual(calls, [['set', { user_id: null }], ['set', 'user_properties', { user_currency: null, user_language: null }]]);
});

test('opting out sets Google\'s ga-disable flag and stops all events; opting back in restores them', () => {
  setOptOut(true);
  assert.equal(globalThis['ga-disable-G-TEST123'], true);
  track('login', { method: 'password' });
  pageView('/', '', 'https://x.test');
  assert.deepEqual(calls, []);
  setOptOut(false);
  assert.equal(globalThis['ga-disable-G-TEST123'], false);
  track('login', { method: 'password' });
  assert.deepEqual(calls, [['event', 'login', { method: 'password' }]]);
});

test('trackThen passes event_callback to gtag and runs the redirect once', async () => {
  let ran = 0;
  trackThen('sample_data_loaded', {}, () => { ran++; }, 20);
  const [, name, params] = calls[0];
  assert.equal(name, 'sample_data_loaded');
  assert.equal(typeof params.event_callback, 'function');
  params.event_callback();
  await new Promise(r => setTimeout(r, 40));
  assert.equal(ran, 1);
});

test('api errors go out as api_error with area and status only', () => {
  trackApiError({ status: 503, url: '/transactions/3f2b8c1e-1234-4abc-9def-0123456789ab?search=salary' });
  assert.deepEqual(calls, [['event', 'api_error', { error_area: 'transactions', error_status: 503 }]]);
});

test('without gtag (dev, or analytics off) events only go to the data layer and nothing throws', () => {
  delete globalThis.__TRACKSY_GA__; delete globalThis.gtag;
  assert.doesNotThrow(() => track('login', { method: 'oauth' }));
  assert.deepEqual(globalThis.dataLayer, [{ event: 'login', method: 'oauth' }]);
});
