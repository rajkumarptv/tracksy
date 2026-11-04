/* ═══════════════════════════════════════════════════════════════════════
   File storage abstraction — Supabase Storage or local disk.

   WHY
   Serverless filesystems are ephemeral: anything written to disk is lost on
   the next cold start. Bill/receipt attachments must therefore live in object
   storage when deployed to Vercel.

   BEHAVIOUR
   • SUPABASE_URL + SUPABASE_SERVICE_KEY set  → Supabase Storage (cloud)
   • otherwise                                → local disk (PC / VPS)

   Uses the Storage REST API via global fetch (Node 18+), so no extra
   dependency and nothing to bundle into the serverless function.
═══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const BUCKET       = process.env.SUPABASE_BILLS_BUCKET || 'bills';

const useSupabase = !!(SUPABASE_URL && SERVICE_KEY);
const isServerless = !!process.env.VERCEL;

const LOCAL_DIR = path.join(__dirname, '../../uploads/bills');
// Only create a local dir on a real (writable) filesystem. Never at module
// load on serverless — its filesystem is read-only and mkdir throws ENOENT,
// crashing the whole function. Guarded so a missing dir can't take the app down.
function ensureLocalDir() {
  if (useSupabase || isServerless) return;
  try {
    if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });
  } catch (e) {
    console.warn('[storage] could not create local dir:', e.message);
  }
}
ensureLocalDir();

const objectUrl = (key) =>
  `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${BUCKET}/${encodeURIComponent(key)}`;

// New-style sb_secret_* keys aren't JWTs: they go in `apikey` only.
const authHeaders = () => ({
  apikey: SERVICE_KEY,
  ...(SERVICE_KEY && SERVICE_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${SERVICE_KEY}` } : {}),
});

/** Create the (private) bucket on first use so a fresh project needs no manual setup. */
let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  });
  // 400/409 = already exists
  if (res.ok || res.status === 400 || res.status === 409) bucketReady = true;
  else throw new Error(`Could not create storage bucket (${res.status}): ${await res.text()}`);
}

/** Store a file. Returns the storage key to persist in the DB. */
async function putObject(key, buffer, contentType = 'application/octet-stream') {
  if (!useSupabase) {
    if (isServerless) throw new Error('File storage not configured — set SUPABASE_SERVICE_KEY to enable bill uploads.');
    ensureLocalDir();
    fs.writeFileSync(path.join(LOCAL_DIR, key), buffer);
    return key;
  }
  const upload = () => fetch(objectUrl(key), {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });
  let res = await upload();
  if (!res.ok && /bucket not found/i.test(await res.clone().text())) {
    await ensureBucket();
    res = await upload();
  }
  if (!res.ok) {
    throw new Error(`Storage upload failed (${res.status}): ${await res.text()}`);
  }
  return key;
}

/** Fetch a file. Returns a Buffer, or null when missing. */
async function getObject(key) {
  if (!useSupabase) {
    const p = path.join(LOCAL_DIR, key);
    return fs.existsSync(p) ? fs.readFileSync(p) : null;
  }
  const res = await fetch(objectUrl(key), {
    headers: authHeaders(),
  });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/** Remove a file. Never throws — deletion is best-effort. */
async function deleteObject(key) {
  try {
    if (!useSupabase) {
      const p = path.join(LOCAL_DIR, key);
      if (fs.existsSync(p)) fs.unlinkSync(p);
      return true;
    }
    const res = await fetch(objectUrl(key), {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return res.ok;
  } catch (e) {
    console.error('[storage] delete failed:', e.message);
    return false;
  }
}

module.exports = { putObject, getObject, deleteObject, usingSupabase: useSupabase };
