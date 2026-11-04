require('dotenv').config();

/* ═══════════════════════════════════════════════════════════════════════
   DB access — two interchangeable drivers behind one { query, pool } API.

   DB_MODE=api  → Supabase REST API. Every statement is sent to the
                  `exec_sql` Postgres function (see backend/supabase/exec_sql.sql)
                  with SUPABASE_URL + SUPABASE_SERVICE_KEY. No Postgres
                  connection string / pooler needed.
   otherwise    → classic `pg` pool (DATABASE_URL or DB_* vars).

   Both return pg-style results ({ rows, rowCount }), so controllers don't care.
═══════════════════════════════════════════════════════════════════════ */
const useApi = process.env.DB_MODE === 'api';

/* ── Supabase REST driver ─────────────────────────────────────────────── */

// Client-side literal escaping (same rules as pg's escapeLiteral). Values are
// sent as untyped literals, exactly like the pg driver's text-format params,
// so `$1::int`, `= ANY($1)` etc. resolve the same way.
function quote(s) {
  if (s.includes('\0')) throw new Error('Invalid character in query parameter');
  const esc = s.replace(/'/g, "''");
  return s.includes('\\') ? `E'${esc.replace(/\\/g, '\\\\')}'` : `'${esc}'`;
}
function arrayLiteral(arr) {
  const items = arr.map((v) => {
    if (v === null || v === undefined) return 'NULL';
    if (Array.isArray(v)) return arrayLiteral(v);
    const s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  });
  return '{' + items.join(',') + '}';
}
function literal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (v instanceof Date) return quote(v.toISOString());
  if (Buffer.isBuffer(v)) return `'\\x${v.toString('hex')}'`;
  if (Array.isArray(v)) return quote(arrayLiteral(v));
  if (typeof v === 'object') return quote(JSON.stringify(v));
  return quote(String(v));
}
function inline(text, params) {
  if (!params || !params.length) return text;
  return text.replace(/\$(\d+)/g, (m, i) => {
    const idx = Number(i) - 1;
    if (idx >= params.length) throw new Error(`Missing value for parameter ${m}`);
    return literal(params[idx]);
  });
}

const returnsRows = (sql) => /^\s*(\(|select|with|values|show|table)\b/i.test(sql) || /\breturning\b/i.test(sql);

async function apiQuery(text, params) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!base || !key) throw new Error('DB_MODE=api needs SUPABASE_URL and SUPABASE_SERVICE_KEY');

  const sql = inline(text, params).trim().replace(/;+\s*$/, '');
  const headers = { 'Content-Type': 'application/json', apikey: key };
  // New-style sb_secret_* keys are not JWTs and must only go in `apikey`.
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;

  const res = await fetch(`${base.replace(/\/$/, '')}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ q: sql, mode: returnsRows(sql) ? 'rows' : 'exec' }),
    signal: AbortSignal.timeout(25000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((body && body.message) || `Supabase API error ${res.status}`);
    if (body) { err.code = body.code; err.detail = body.details; err.hint = body.hint; }
    if (res.status === 404 && body && /exec_sql/.test(body.message || '')) {
      err.message = 'exec_sql function missing — run backend/supabase/exec_sql.sql in the Supabase SQL editor';
    }
    throw err;
  }
  return { rows: body.rows || [], rowCount: body.rowCount ?? 0 };
}

/* Statements can't share a connection over HTTP, so there are no interactive
   transactions in api mode. BEGIN/COMMIT/ROLLBACK/SET LOCAL become no-ops and
   each statement commits on its own. Every transactional caller (migrate,
   seed, sample-data) is idempotent or tagged is_sample, so a failed run is
   cleaned up by simply re-running it. */
const TX_NOOP = /^\s*(begin|commit|rollback|start transaction|set\s+local)\b/i;
const apiClient = {
  query: (text, params) => (TX_NOOP.test(text) ? Promise.resolve({ rows: [], rowCount: 0 }) : apiQuery(text, params)),
  release() {},
};
const apiPool = {
  query: apiQuery,
  connect: async () => apiClient,
  end: async () => {},
  on() {},
};

/* ── pg driver ────────────────────────────────────────────────────────── */

function makePgPool() {
  const { Pool } = require('pg');
  const isServerless = !!process.env.VERCEL;
  return process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        // Serverless: each function instance gets its own pool, and Supabase's
        // transaction pooler already multiplexes — so cap at 1 to avoid
        // exhausting connections across many concurrent lambdas.
        max: isServerless ? 1 : 10,
        idleTimeoutMillis: isServerless ? 10000 : 30000,
        connectionTimeoutMillis: 10000,
      })
    : new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'tracksy_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
}

const pool = useApi ? apiPool : makePgPool();
if (!useApi) {
  pool.on('error', (err) => console.error('Unexpected DB pool error:', err));
}

const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log('Query executed:', { text: text.substring(0, 60), duration, rows: res.rowCount });
  }
  return res;
};

const getClient = () => pool.connect();

module.exports = { query, getClient, pool, inline };
