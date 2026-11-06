// Single entry point for analytics. Everything goes through the allow-list in analyticsEvents.js,
// so nothing outside the catalogue (no PII, names, amounts or free text) can reach the data layer.
// GTM reads window.dataLayer; the tags themselves live in the GTM container (see /analytics).
import { EVENTS, PARAMS, USER_PROPS } from './analyticsEvents.js';

const OPT_KEY = 'tracksy-analytics-optout';
const root = () => (typeof window !== 'undefined' ? window : globalThis);

/* ── Opt-out (Settings switch) and Global Privacy Control ────────────────── */
export function isEnabled() {
  try {
    if (typeof navigator !== 'undefined' && navigator.globalPrivacyControl === true) return false;
    if (globalThis.localStorage && globalThis.localStorage.getItem(OPT_KEY) === '1') return false;
  } catch { /* storage blocked: treat as enabled */ }
  return true;
}

export function setOptOut(optedOut) {
  try {
    if (!globalThis.localStorage) return;
    if (optedOut) globalThis.localStorage.setItem(OPT_KEY, '1');
    else globalThis.localStorage.removeItem(OPT_KEY);
  } catch { /* ignore */ }
}

/* ── Validation ──────────────────────────────────────────────────────────── */
function coerce(def, value) {
  if (!def) return undefined;
  switch (def.type) {
    case 'enum':    return def.values.map(String).includes(String(value)) ? String(value) : undefined;
    case 'bool':    return typeof value === 'boolean' ? value : undefined;
    case 'int':     return Number.isInteger(value) && value >= 0 && value <= def.max ? value : undefined;
    case 'pattern': return typeof value === 'string' && value.length <= 200 && def.pattern.test(value) ? value : undefined;
    default:        return undefined;
  }
}

/** Returns the cleaned params for a known event, or null for an unknown event. Invalid params are dropped. */
export function sanitize(event, params = {}) {
  const spec = EVENTS[event];
  if (!spec) return null;
  const clean = {};
  for (const key of spec.params) {
    if (!(key in params)) continue;
    const v = coerce(PARAMS[key], params[key]);
    if (v !== undefined) clean[key] = v;
  }
  return clean;
}

export function sanitizeUserProps(props = {}) {
  const clean = {};
  for (const key of Object.keys(USER_PROPS)) {
    if (!(key in props)) continue;
    const v = coerce(USER_PROPS[key], props[key]);
    if (v !== undefined) clean[key] = v;
  }
  return clean;
}

const push = (obj) => {
  const r = root();
  r.dataLayer = r.dataLayer || [];
  r.dataLayer.push(obj);
};

/* ── Public API ──────────────────────────────────────────────────────────── */
export function track(event, params = {}) {
  if (!isEnabled()) return;
  const clean = sanitize(event, params);
  if (!clean) return;
  push({ event, ...clean });
}

/**
 * Track, then run `next` once the hit has been handed to GTM (or after a short timeout if GTM isn't
 * there). Use it right before a hard redirect so the event isn't lost with the page.
 */
export function trackThen(event, params, next, timeout = 800) {
  let done = false;
  const go = () => { if (!done) { done = true; next(); } };
  if (!isEnabled()) { go(); return; }
  const clean = sanitize(event, params);
  if (!clean) { go(); return; }
  push({ event, ...clean, eventCallback: go, eventTimeout: timeout });
  setTimeout(go, timeout);
}

/* ── Page views ──────────────────────────────────────────────────────────── */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** '/transactions?search=rent' -> '/transactions'; '/debts?tab=payoff' keeps the tab; ids and tokens are masked. */
export function normalizePath(pathname = '/', search = '') {
  const segments = String(pathname).split('/').filter(Boolean).map(seg => {
    const s = seg.toLowerCase();
    if (UUID.test(seg) || /^\d+$/.test(seg)) return ':id';
    if (seg.length > 24 || !/^[a-z0-9_-]+$/.test(s)) return ':token';
    return s;
  });
  let path = '/' + segments.join('/');
  const tab = new URLSearchParams(search).get('tab');
  if (tab && /^[a-z-]{1,20}$/.test(tab)) path += `?tab=${tab}`;
  return path;
}

const PAGE_NAMES = {
  '/': 'Dashboard', '/login': 'Sign in', '/register': 'Sign up', '/forgot-password': 'Forgot password',
  '/reset-password': 'Reset password', '/auth/callback': 'Auth callback',
  '/transactions': 'Transactions', '/wallet': 'Accounts', '/goals': 'Goals', '/budget': 'Budget',
  '/categories': 'Categories', '/debts': 'Debts', '/debts?tab=payoff': 'Debt payoff planner',
  '/insights': 'Insights', '/insights?tab=tips': 'Smart insights', '/forecast': 'Forecast',
  '/import': 'Import', '/recurring': 'Recurring', '/family': 'Family', '/settings': 'Settings', '/admin': 'Admin',
};

export const pageTitle = (path) => PAGE_NAMES[path] || PAGE_NAMES[path.split('?')[0]] || 'Other';

let lastView = { key: '', at: 0 };
export function resetPageViewDedupe() { lastView = { key: '', at: 0 }; }

/** One virtual_page_view per route change. Duplicates within 750 ms (StrictMode, reload remounts) are dropped. */
export function pageView(pathname, search = '', origin = '') {
  if (!isEnabled()) return;
  const path = normalizePath(pathname, search);
  const now = Date.now();
  if (lastView.key === path && now - lastView.at < 750) return;
  lastView = { key: path, at: now };
  const o = origin || (typeof location !== 'undefined' ? location.origin : '');
  track('virtual_page_view', { page_location: `${o}${path}`, page_title: pageTitle(path) });
}

/* ── User context (pseudonymous) ─────────────────────────────────────────── */
async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const detectPlatform = () => {
  try { return root().Capacitor?.isNativePlatform?.() ? 'android' : 'web'; } catch { return 'web'; }
};

let lastUserId = '';
/**
 * Sets the pseudonymous user id and a few non-identifying properties. Pass ONLY these fields,
 * never the whole user object. The raw id is hashed before it leaves this function.
 */
export async function setUserContext({ id, currency, language, theme } = {}) {
  if (!isEnabled() || !id) return;
  try {
    const user_id = await sha256Hex(`tracksy:${id}`);
    if (user_id === lastUserId) return;
    lastUserId = user_id;
    const props = sanitizeUserProps({ user_id, user_currency: currency, user_language: language, platform: detectPlatform(), ui_theme: theme });
    push({ event: 'user_context', ...props });
  } catch { /* crypto unavailable: skip silently */ }
}

export function clearUserContext() {
  lastUserId = '';
  if (!isEnabled()) return;
  push({ event: 'user_context', user_id: undefined, user_currency: undefined, user_language: undefined });
}

/* ── Small helpers shared by call sites ──────────────────────────────────── */
export function bucket(n) {
  const v = Number(n) || 0;
  if (v <= 0) return '0';
  if (v === 1) return '1';
  if (v <= 5) return '2-5';
  if (v <= 20) return '6-20';
  if (v <= 100) return '21-100';
  return '100+';
}

export function extraBucket(n) {
  const v = Number(n) || 0;
  if (v <= 0) return '0';
  if (v < 2000) return '1k';
  if (v < 5000) return '2k';
  if (v < 10000) return '5k';
  return '10k+';
}

/** Wallet type -> the coarse account_type enum. */
export function accountType(walletType) {
  const t = String(walletType || '').toLowerCase();
  if (t === 'bank') return 'bank';
  if (t === 'cash') return 'cash';
  if (t === 'visa' || t === 'mastercard' || t === 'credit_card') return 'card';
  if (/loan|emi|bnpl|family_borrow|lending/.test(t)) return 'loan';
  if (t === 'asset' || t === 'crypto' || t === 'investment') return 'investment';
  if (/gpay|phonepe|paytm|amazon|mobikwik|jio|airtel|irctc|paypal/.test(t)) return 'wallet';
  return 'other';
}

/** Coarser still, for debt screens. */
export function debtType(walletType) {
  const a = accountType(walletType);
  return a === 'card' ? 'card' : a === 'loan' ? 'loan' : 'other';
}
