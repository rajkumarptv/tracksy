import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  track, trackThen, sanitize, sanitizeUserProps, normalizePath, pageView, resetPageViewDedupe,
  setUserContext, isEnabled, setOptOut, bucket, extraBucket, accountType, debtType,
  trackApiError, resetApiErrorState,
} from './analytics.js';
import { EVENTS, PARAMS, USER_PROPS, FORBIDDEN_PARAM_NAMES } from './analyticsEvents.js';

// Minimal browser stand-ins
const store = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
});
const setGPC = v => Object.defineProperty(globalThis.navigator, 'globalPrivacyControl', { configurable: true, value: v });

beforeEach(() => { globalThis.dataLayer = []; store.clear(); setGPC(undefined); resetPageViewDedupe(); resetApiErrorState(); });

test('known events pass through with valid params only', () => {
  track('transaction_added', { tx_type: 'expense', tx_source: 'manual' });
  assert.deepEqual(globalThis.dataLayer, [{ event: 'transaction_added', tx_type: 'expense', tx_source: 'manual' }]);
});

test('PII and unknown params are dropped even if a caller passes them', () => {
  track('sign_up', { method: 'password', email: 'a@b.com', first_name: 'Asha', amount: 5000, token: 'abc' });
  assert.deepEqual(globalThis.dataLayer, [{ event: 'sign_up', method: 'password' }]);
  assert.ok(!JSON.stringify(globalThis.dataLayer).includes('@'));
});

test('invalid values are dropped, not coerced: wrong enum, wrong type, object, oversize', () => {
  assert.deepEqual(sanitize('transaction_added', { tx_type: 'groceries', tx_source: { x: 1 } }), {});
  assert.deepEqual(sanitize('debt_added', { debt_type: 'card', has_rate: 'yes' }), { debt_type: 'card' });
  assert.deepEqual(sanitize('forecast_range_changed', { forecast_days: 60.5 }), {});
  assert.deepEqual(sanitize('forecast_range_changed', { forecast_days: 9999 }), {});
  assert.deepEqual(sanitize('forecast_range_changed', { forecast_days: 90 }), { forecast_days: 90 });
  assert.deepEqual(sanitize('currency_changed', { currency: 'rupees' }), {});
  assert.deepEqual(sanitize('currency_changed', { currency: 'INR' }), { currency: 'INR' });
});

test('unknown events are ignored entirely', () => {
  track('shared_my_balance', { tx_type: 'income' });
  assert.deepEqual(globalThis.dataLayer, []);
  assert.equal(sanitize('nope'), null);
});

test('catalogue is clean: no forbidden param names, every listed param is defined, enums contain no PII-looking values', () => {
  const all = new Set([...Object.keys(PARAMS), ...Object.keys(USER_PROPS)]);
  for (const bad of FORBIDDEN_PARAM_NAMES) assert.ok(!all.has(bad), `forbidden param ${bad}`);
  for (const [name, ev] of Object.entries(EVENTS)) {
    for (const p of ev.params) assert.ok(PARAMS[p], `${name} uses undefined param ${p}`);
    assert.match(name, /^[a-z][a-z0-9_]*$/);
  }
  for (const def of [...Object.values(PARAMS), ...Object.values(USER_PROPS)]) {
    if (def.type === 'enum') for (const v of def.values) assert.ok(!/[@\d]{6,}/.test(v));
  }
  assert.ok(Object.keys(EVENTS).length <= 60, 'GA4 allows 500 event names, but keep the taxonomy small');
});

test('normalizePath strips queries, keeps only a safe tab, and masks ids and tokens', () => {
  assert.equal(normalizePath('/transactions', '?search=salary+from+acme'), '/transactions');
  assert.equal(normalizePath('/debts', '?tab=payoff'), '/debts?tab=payoff');
  assert.equal(normalizePath('/debts', '?tab=<script>'), '/debts');
  assert.equal(normalizePath('/reset-password', '?token=eyJhbGciOi'), '/reset-password');
  assert.equal(normalizePath('/auth/callback', '?token=abc'), '/auth/callback');
  assert.equal(normalizePath('/family/3f2b8c1e-1234-4abc-9def-0123456789ab'), '/family/:id');
  assert.equal(normalizePath('/x/12345'), '/x/:id');
  assert.equal(normalizePath('/x/' + 'a'.repeat(40)), '/x/:token');
  assert.equal(normalizePath('/Transactions/'), '/transactions');
  assert.equal(normalizePath('/', ''), '/');
});

test('pageView pushes a normalised location and title, and drops a duplicate within 750ms', () => {
  pageView('/debts', '?tab=payoff&x=secret', 'https://tracksy.example');
  pageView('/debts', '?tab=payoff', 'https://tracksy.example');
  assert.equal(globalThis.dataLayer.length, 1);
  assert.deepEqual(globalThis.dataLayer[0], { event: 'virtual_page_view', page_location: 'https://tracksy.example/debts?tab=payoff', page_title: 'Debt payoff planner' });
  pageView('/forecast', '', 'https://tracksy.example');
  assert.equal(globalThis.dataLayer.length, 2);
  assert.equal(globalThis.dataLayer[1].page_title, 'Forecast');
});

test('opt-out and Global Privacy Control silence everything', () => {
  assert.equal(isEnabled(), true);
  setOptOut(true);
  assert.equal(isEnabled(), false);
  track('login', { method: 'password' });
  pageView('/', '', 'https://x.test');
  assert.deepEqual(globalThis.dataLayer, []);
  setOptOut(false);
  assert.equal(isEnabled(), true);
  setGPC(true);
  assert.equal(isEnabled(), false);
  track('logout');
  assert.deepEqual(globalThis.dataLayer, []);
});

test('trackThen runs the callback once, and straight away when tracking is off', async () => {
  let calls = 0;
  trackThen('sample_data_loaded', {}, () => { calls++; }, 20);
  const pushed = globalThis.dataLayer[0];
  assert.equal(pushed.event, 'sample_data_loaded');
  pushed.eventCallback();           // GTM calling back
  await new Promise(r => setTimeout(r, 40));   // then the timeout fires too
  assert.equal(calls, 1);

  setOptOut(true);
  trackThen('sample_data_loaded', {}, () => { calls++; }, 20);
  assert.equal(calls, 2);
});

test('user context hashes the id, never carries the raw id or other fields, and de-dupes', async () => {
  await setUserContext({ id: 'user-1234', currency: 'INR', language: 'en', theme: 'dark', email: 'a@b.com', first_name: 'Asha' });
  assert.equal(globalThis.dataLayer.length, 1);
  const ctx = globalThis.dataLayer[0];
  assert.equal(ctx.event, 'user_context');
  assert.match(ctx.user_id, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(ctx).includes('user-1234'));
  assert.ok(!('email' in ctx) && !('first_name' in ctx));
  assert.equal(ctx.user_currency, 'INR');
  assert.equal(ctx.platform, 'web');
  await setUserContext({ id: 'user-1234', currency: 'INR' });
  assert.equal(globalThis.dataLayer.length, 1);
});

test('sanitizeUserProps rejects malformed values', () => {
  assert.deepEqual(sanitizeUserProps({ user_id: 'not-a-hash', user_currency: 'inr', platform: 'ios' }), {});
});

test('helpers: buckets and coarse account/debt types', () => {
  assert.deepEqual([0, 1, 4, 15, 50, 500].map(bucket), ['0', '1', '2-5', '6-20', '21-100', '100+']);
  assert.deepEqual([0, 500, 2500, 7000, 20000].map(extraBucket), ['0', '1k', '2k', '5k', '10k+']);
  assert.equal(accountType('visa'), 'card');
  assert.equal(accountType('home_loan'), 'loan');
  assert.equal(accountType('gpay'), 'wallet');
  assert.equal(accountType('mystery'), 'other');
  assert.equal(debtType('mastercard'), 'card');
  assert.equal(debtType('gold_loan'), 'loan');
  assert.equal(debtType('bank'), 'other');
});

test('api_error: only 5xx and network failures, area + status only, never 4xx or cancelled', () => {
  trackApiError({ status: 400, url: '/transactions' });
  trackApiError({ status: 401, url: '/auth/me' });
  trackApiError({ status: 404, url: '/goals/123' });
  trackApiError({ status: 500, url: '/transactions', cancelled: true });
  assert.deepEqual(globalThis.dataLayer, []);

  trackApiError({ status: 503, url: '/transactions/3f2b8c1e-1234-4abc-9def-0123456789ab?search=salary' });
  trackApiError({ status: 0, url: '/forecast/cashflow' });          // network failure or timeout
  assert.deepEqual(globalThis.dataLayer, [
    { event: 'api_error', error_area: 'transactions', error_status: 503 },
    { event: 'api_error', error_area: 'forecast', error_status: 0 },
  ]);
  assert.ok(!JSON.stringify(globalThis.dataLayer).includes('salary'));
});

test('api_error is rate-limited: once per area+status per minute, ten per session', () => {
  trackApiError({ status: 500, url: '/goals' });
  trackApiError({ status: 500, url: '/goals' });
  assert.equal(globalThis.dataLayer.length, 1);
  for (let i = 0; i < 20; i++) trackApiError({ status: 500, url: `/area${String.fromCharCode(97 + i)}` });
  assert.equal(globalThis.dataLayer.length, 10);
});
