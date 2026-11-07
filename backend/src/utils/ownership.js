// A client may send wallet/category ids in a request body. Before storing one, check that it belongs to
// the signed-in user (categories may also be a shared default). Without this a row could point at
// another user's wallet or category.
const { query } = require('../db');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ownsWallet(userId, id) {
  if (id === undefined || id === null || id === '') return true;      // optional field left empty
  if (!UUID_RE.test(String(id))) return false;
  const r = await query('SELECT 1 FROM wallets WHERE id=$1 AND user_id=$2', [id, userId]);
  return r.rows.length > 0;
}

async function ownsCategory(userId, id) {
  if (id === undefined || id === null || id === '') return true;
  if (!UUID_RE.test(String(id))) return false;
  const r = await query('SELECT 1 FROM categories WHERE id=$1 AND (user_id=$2 OR is_default=true)', [id, userId]);
  return r.rows.length > 0;
}

/** Returns an error message when any of the given ids isn't the user's, else null. */
async function foreignIdProblem(userId, { wallets = [], categories = [] } = {}) {
  for (const w of wallets) if (!(await ownsWallet(userId, w))) return 'Account not found';
  for (const c of categories) if (!(await ownsCategory(userId, c))) return 'Category not found';
  return null;
}

module.exports = { ownsWallet, ownsCategory, foreignIdProblem };
