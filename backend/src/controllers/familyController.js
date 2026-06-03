const { query } = require('../db');
const { decryptRow } = require('../utils/crypto');

const decryptWallet = row => decryptRow(row, ['name']);

async function isPremium(userId) {
  const r = await query('SELECT is_premium, premium_expires_at FROM users WHERE id=$1', [userId]);
  const u = r.rows[0];
  if (!u || !u.is_premium) return false;
  if (u.premium_expires_at && new Date(u.premium_expires_at) < new Date()) return false;
  return true;
}

// Generate an unambiguous 6-char code (no 0/O/1/I)
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

const premiumGate = (res) =>
  res.status(403).json({ success:false, code:'FREE_LIMIT_FAMILY',
    message:'Family Budget is a Premium feature. Upgrade to create or join a family.' });

/* ── GET /api/family/status ─────────────────────────────────────────────────
   Any user: their family state, role, code (primary only), and members list.
*/
const getStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const me = (await query(
      `SELECT u.family_id, u.family_role, f.name AS family_name, f.family_code
       FROM users u LEFT JOIN families f ON u.family_id=f.id
       WHERE u.id=$1`, [userId]
    )).rows[0];

    let members = [];
    if (me?.family_id) {
      members = (await query(
        `SELECT id, first_name || ' ' || last_name AS name, email, family_role
         FROM users WHERE family_id=$1 ORDER BY family_role='primary' DESC, created_at`,
        [me.family_id]
      )).rows.map(m => ({ ...m, is_me: m.id === userId }));
    }

    res.json({ success:true, data: {
      in_family:   !!me?.family_id,
      role:        me?.family_role || null,
      family_name: me?.family_name || null,
      // Only the primary sees/shares the code
      family_code: me?.family_role === 'primary' ? me.family_code : null,
      members,
      is_premium:  await isPremium(userId),
    }});
  } catch (err) {
    console.error('Family status error:', err);
    res.status(500).json({ success:false, message:'Server error' });
  }
};

/* ── POST /api/family/create ────────────────────────────────────────────────
   Premium user creates a family and becomes the primary. Returns join code.
*/
const createFamily = async (req, res) => {
  try {
    const userId = req.user.userId;
    if (!(await isPremium(userId))) return premiumGate(res);

    const { name } = req.body;
    if (!name || !name.trim())
      return res.status(400).json({ success:false, message:'Family name is required' });

    // Already in a family?
    const me = (await query('SELECT family_id FROM users WHERE id=$1', [userId])).rows[0];
    if (me?.family_id)
      return res.status(409).json({ success:false, message:'You are already in a family. Leave it first.' });

    // Generate a unique code
    let code, exists = true, tries = 0;
    while (exists && tries < 10) {
      code = genCode();
      exists = (await query('SELECT 1 FROM families WHERE family_code=$1', [code])).rows.length > 0;
      tries++;
    }

    const fam = (await query(
      'INSERT INTO families (name, primary_user_id, family_code) VALUES ($1,$2,$3) RETURNING id, name, family_code',
      [name.trim(), userId, code]
    )).rows[0];

    await query(`UPDATE users SET family_id=$1, family_role='primary' WHERE id=$2`, [fam.id, userId]);

    res.status(201).json({ success:true, data: { id: fam.id, name: fam.name, family_code: fam.family_code } });
  } catch (err) {
    console.error('Create family error:', err);
    res.status(500).json({ success:false, message:'Server error' });
  }
};

/* ── POST /api/family/join ──────────────────────────────────────────────────
   User joins a family by entering its code (this is their consent).
*/
const joinFamily = async (req, res) => {
  try {
    const userId = req.user.userId;
    if (!(await isPremium(userId))) return premiumGate(res);

    const code = (req.body.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ success:false, message:'Family code is required' });

    const me = (await query('SELECT family_id FROM users WHERE id=$1', [userId])).rows[0];
    if (me?.family_id)
      return res.status(409).json({ success:false, message:'You are already in a family. Leave it first.' });

    const fam = (await query('SELECT id, name FROM families WHERE family_code=$1', [code])).rows[0];
    if (!fam) return res.status(404).json({ success:false, message:'Invalid family code. Check with your family head.' });

    await query(`UPDATE users SET family_id=$1, family_role='member' WHERE id=$2`, [fam.id, userId]);

    res.json({ success:true, data: { family_name: fam.name },
      message:`You joined "${fam.name}". The family head can now see your accounts and spending.` });
  } catch (err) {
    console.error('Join family error:', err);
    res.status(500).json({ success:false, message:'Server error' });
  }
};

/* ── POST /api/family/leave ─────────────────────────────────────────────────
   Member leaves (revokes access). Primary leaving disbands the family.
*/
const leaveFamily = async (req, res) => {
  try {
    const userId = req.user.userId;
    const me = (await query('SELECT family_id, family_role FROM users WHERE id=$1', [userId])).rows[0];
    if (!me?.family_id) return res.status(400).json({ success:false, message:'You are not in a family.' });

    if (me.family_role === 'primary') {
      // Disband: detach all members then delete the family
      await query(`UPDATE users SET family_id=NULL, family_role=NULL WHERE family_id=$1`, [me.family_id]);
      await query(`DELETE FROM families WHERE id=$1`, [me.family_id]);
      return res.json({ success:true, message:'Family disbanded. All members have been removed.' });
    }

    await query(`UPDATE users SET family_id=NULL, family_role=NULL WHERE id=$1`, [userId]);
    res.json({ success:true, message:'You left the family.' });
  } catch (err) {
    console.error('Leave family error:', err);
    res.status(500).json({ success:false, message:'Server error' });
  }
};

/* ── POST /api/family/remove-member ─────────────────────────────────────────
   Primary removes a member from the family.
*/
const removeMember = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { member_id } = req.body;
    const me = (await query('SELECT family_id, family_role FROM users WHERE id=$1', [userId])).rows[0];
    if (me?.family_role !== 'primary')
      return res.status(403).json({ success:false, message:'Only the family head can remove members.' });

    const member = (await query('SELECT family_id, family_role FROM users WHERE id=$1', [member_id])).rows[0];
    if (!member || member.family_id !== me.family_id)
      return res.status(404).json({ success:false, message:'That user is not in your family.' });
    if (member.family_role === 'primary')
      return res.status(400).json({ success:false, message:'Cannot remove the family head.' });

    await query(`UPDATE users SET family_id=NULL, family_role=NULL WHERE id=$1`, [member_id]);
    res.json({ success:true, message:'Member removed from family.' });
  } catch (err) {
    res.status(500).json({ success:false, message:'Server error' });
  }
};

/* ── GET /api/family/overview ───────────────────────────────────────────────
   Primary only. Combined + per-member income/expense/net/net-worth.
*/
const getOverview = async (req, res) => {
  try {
    const userId = req.user.userId;
    if (!(await isPremium(userId))) return premiumGate(res);

    const me = (await query('SELECT family_id, family_role FROM users WHERE id=$1', [userId])).rows[0];
    if (!me?.family_id || me.family_role !== 'primary')
      return res.status(403).json({ success:false, code:'NOT_PRIMARY',
        message:'Only the family head can view the family overview.' });

    const family  = (await query('SELECT id, name, family_code FROM families WHERE id=$1', [me.family_id])).rows[0];
    const members = (await query(
      `SELECT id, first_name, last_name, email, family_role, avatar_url
       FROM users WHERE family_id=$1 ORDER BY family_role='primary' DESC, created_at`,
      [me.family_id]
    )).rows;

    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1;
    const startDate = `${y}-${String(m).padStart(2,'0')}-01`;
    const endDate   = m === 12 ? `${y+1}-01-01` : `${y}-${String(m+1).padStart(2,'0')}-01`;

    const memberStats = await Promise.all(members.map(async (mem) => {
      const [statsRes, balRes, walletCount] = await Promise.all([
        query(`SELECT
            COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END),0) AS income,
            COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expense
           FROM transactions
           WHERE user_id=$1 AND transaction_date>=$2 AND transaction_date<$3 AND status='completed'`,
          [mem.id, startDate, endDate]),
        query(`SELECT COALESCE(SUM(
            CASE WHEN type IN ('visa','mastercard','loan','lending') THEN -ABS(balance) ELSE balance END
          ),0) AS net_balance FROM wallets WHERE user_id=$1`, [mem.id]),
        query('SELECT COUNT(*) AS c FROM wallets WHERE user_id=$1', [mem.id]),
      ]);
      const income  = parseFloat(statsRes.rows[0].income);
      const expense = parseFloat(statsRes.rows[0].expense);
      return {
        id: mem.id, name: `${mem.first_name} ${mem.last_name}`.trim(), email: mem.email,
        role: mem.family_role, avatar_url: mem.avatar_url,
        income, expense, net: income - expense,
        net_balance: parseFloat(balRes.rows[0].net_balance),
        wallet_count: parseInt(walletCount.rows[0].c),
        is_me: mem.id === userId,
      };
    }));

    const combined = memberStats.reduce((a, s) => ({
      income: a.income + s.income, expense: a.expense + s.expense, net_balance: a.net_balance + s.net_balance,
    }), { income:0, expense:0, net_balance:0 });

    res.json({ success:true, data: {
      family, members: memberStats,
      combined: { ...combined, net: combined.income - combined.expense },
      period: { month:m, year:y },
    }});
  } catch (err) {
    console.error('Family overview error:', err);
    res.status(500).json({ success:false, message:'Server error' });
  }
};

/* ── GET /api/family/member/:id ─────────────────────────────────────────────
   Primary views one member's accounts + recent transactions.
*/
const getMemberDetail = async (req, res) => {
  try {
    const userId   = req.user.userId;
    const memberId = req.params.id;
    if (!(await isPremium(userId))) return premiumGate(res);

    const me = (await query('SELECT family_id, family_role FROM users WHERE id=$1', [userId])).rows[0];
    if (!me?.family_id || me.family_role !== 'primary')
      return res.status(403).json({ success:false, message:'Only the family head can view member details.' });

    const member = (await query(
      'SELECT id, first_name, last_name, email, family_id FROM users WHERE id=$1', [memberId]
    )).rows[0];
    if (!member || member.family_id !== me.family_id)
      return res.status(403).json({ success:false, message:'That user is not in your family.' });

    const [wallets, recentTx] = await Promise.all([
      query('SELECT * FROM wallets WHERE user_id=$1 ORDER BY created_at', [memberId]),
      query(`SELECT t.id, t.type, t.amount, t.description, t.payment_name, t.transaction_date,
                    c.name AS category_name, c.emoji AS category_emoji
             FROM transactions t LEFT JOIN categories c ON t.category_id=c.id
             WHERE t.user_id=$1 ORDER BY t.transaction_date DESC LIMIT 20`, [memberId]),
    ]);

    res.json({ success:true, data: {
      member: { id: member.id, name: `${member.first_name} ${member.last_name}`.trim(), email: member.email },
      wallets: wallets.rows.map(decryptWallet).map(w => ({ ...w, balance: parseFloat(w.balance||0) })),
      recent_transactions: recentTx.rows.map(t => ({ ...t, amount: parseFloat(t.amount) })),
    }});
  } catch (err) {
    console.error('Family member detail error:', err);
    res.status(500).json({ success:false, message:'Server error' });
  }
};

module.exports = { getStatus, createFamily, joinFamily, leaveFamily, removeMember, getOverview, getMemberDetail };
