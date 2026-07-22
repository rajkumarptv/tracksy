/* ═══════════════════════════════════════════════════════════════════════
   Gmail auto-import job.

   Shared by two callers so the logic lives in exactly one place:
     • node-cron        → long-running deploys (local / VPS / Render)
     • POST /api/cron/gmail-sync → serverless (Vercel), triggered by an
       external scheduler such as cron-job.org
═══════════════════════════════════════════════════════════════════════ */
const { query } = require('../db');
const { syncUserGmail } = require('../controllers/gmailController');

/**
 * Sync Gmail for every eligible user.
 * @param {{ days?: number }} opts
 * @returns {Promise<{ users: number, imported: number, failed: number }>}
 */
async function runGmailSyncForAllUsers({ days = 2 } = {}) {
  const users = (await query(
    `SELECT id FROM users
      WHERE gmail_connected = true
        AND gmail_sync_enabled = true
        AND is_premium = true
        AND gmail_refresh_token IS NOT NULL`
  )).rows;

  console.log(`[gmail-sync] syncing ${users.length} user(s)…`);

  let imported = 0, failed = 0;
  for (const u of users) {
    try {
      const r = await syncUserGmail(u.id, { days });
      if (r?.imported) {
        imported += r.imported;
        console.log(`[gmail-sync] user ${u.id}: +${r.imported} txns`);
      }
    } catch (e) {
      failed++;
      console.error(`[gmail-sync] user ${u.id} failed:`, e.message);
    }
  }

  return { users: users.length, imported, failed };
}

module.exports = { runGmailSyncForAllUsers };
