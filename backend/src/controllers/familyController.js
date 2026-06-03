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

/* ── GET /api/family/overview ───────────────────────────────────────────────
   Only the PRIMARY member can call this.
   Returns each member's monthly income/expense/balance + combined totals.
*/
const getOverview = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Premium gate
    if (!(await isPremium(userId))) {
      return res.status(403).json({ success:false, code:'FREE_LIMIT_FAMILY',
        message:'Family Budget is a Premium feature. Upgrade to manage your family.' });
    }

    // Must be a primary member of a family
    const me = (await query(
      'SELECT family_id, family_role FROM users WHERE id=$1', [userId]
    )).rows[0];

    if (!me?.family_id || me.family_role !== 'primary') {
      return res.status(403).json({ success:false, code:'NOT_PRIMARY',
        message:'Only the primary family member can view the family overview.' });
    }

    // Family details
    const family = (await query('SELECT id, name FROM families WHERE id=$1', [me.family_id])).rows[0];

    // All members of this family
    const members = (await query(
      `SELECT id, first_name, last_name, email, family_role, avatar_url
       FROM users WHERE family_id=$1 ORDER BY family_role='primary' DESC, created_at`,
      [me.family_id]
    )).rows;

    // Current month range
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1;
    const startDate = `${y}-${String(m).padStart(2,'0')}-01`;
    const endDate   = m === 12 ? `${y+1}-01-01` : `${y}-${String(m+1).padStart(2,'0')}-01`;

    // Per-member stats
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
        id:          mem.id,
        name:        `${mem.first_name} ${mem.last_name}`.trim(),
        email:       mem.email,
        role:        mem.family_role,
        avatar_url:  mem.avatar_url,
        income, expense,
        net:         income - expense,
        net_balance: parseFloat(balRes.rows[0].net_balance),
        wallet_count: parseInt(walletCount.rows[0].c),
        is_me:       mem.id === userId,
      };
    }));

    // Combined totals
    const combined = memberStats.reduce((acc, s) => ({
      income:      acc.income      + s.income,
      expense:     acc.expense     + s.expense,
      net_balance: acc.net_balance + s.net_balance,
    }), { income:0, expense:0, net_balance:0 });

    res.json({ success:true, data: {
      family,
      members: memberStats,
      combined: { ...combined, net: combined.income - combined.expense },
      period: { month:m, year:y },
    }});
  } catch (err) {
    console.error('Family overview error:', err);
    res.status(500).json({ success:false, message:'Server error' });
  }
};

/* ── GET /api/family/member/:id ─────────────────────────────────────────────
   Primary member views a single family member's accounts + recent transactions.
*/
const getMemberDetail = async (req, res) => {
  try {
    const userId   = req.user.userId;
    const memberId = req.params.id;

    if (!(await isPremium(userId))) {
      return res.status(403).json({ success:false, code:'FREE_LIMIT_FAMILY',
        message:'Family Budget is a Premium feature.' });
    }

    // Verify caller is primary and member belongs to same family
    const me = (await query('SELECT family_id, family_role FROM users WHERE id=$1', [userId])).rows[0];
    if (!me?.family_id || me.family_role !== 'primary') {
      return res.status(403).json({ success:false, message:'Only the primary member can view member details.' });
    }
    const member = (await query(
      'SELECT id, first_name, last_name, email, family_id FROM users WHERE id=$1', [memberId]
    )).rows[0];
    if (!member || member.family_id !== me.family_id) {
      return res.status(403).json({ success:false, message:'That user is not in your family.' });
    }

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

/* ── GET /api/family/status ─────────────────────────────────────────────────
   Any user: returns whether they're in a family and their role.
*/
const getStatus = async (req, res) => {
  try {
    const me = (await query(
      `SELECT u.family_id, u.family_role, f.name AS family_name
       FROM users u LEFT JOIN families f ON u.family_id=f.id
       WHERE u.id=$1`, [req.user.userId]
    )).rows[0];
    res.json({ success:true, data: {
      in_family:   !!me?.family_id,
      role:        me?.family_role || null,
      family_name: me?.family_name || null,
    }});
  } catch (err) {
    res.status(500).json({ success:false, message:'Server error' });
  }
};

module.exports = { getOverview, getMemberDetail, getStatus };
