const { query } = require('../db');
const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// ── Send WhatsApp reply ───────────────────────────────────────────────────────
const sendReply = (to, message) =>
  client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to,
    body: message,
  });

// ── Natural language parser ───────────────────────────────────────────────────
function parseMessage(text) {
  const raw = text.trim();
  const lower = raw.toLowerCase();

  // ── Special commands ──
  if (/^(help|hi|hello|hey|commands|\?)$/i.test(lower)) return { cmd: 'help' };
  if (/^(balance|bal|accounts|account)$/i.test(lower))  return { cmd: 'balance' };

  // ── Must contain a number ──
  const amountMatch = lower.match(/(\d+(?:\.\d{1,2})?)/);
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1]);
  if (amount <= 0) return null;

  // ── Determine type ──
  let type = 'expense'; // default
  if (/\b(income|received|receive|got|get|salary|paycheck|earned|earn|credited|credit|refund)\b/.test(lower)) type = 'income';
  if (/\b(expense|spent|spend|paid|pay|bought|buy|debited|debit|purchased)\b/.test(lower))                     type = 'expense';

  // ── Category keyword matching ──
  const CATS = [
    ['Food',       /\b(food|groceries?|grocery|restaurant|eat|lunch|dinner|breakfast|swiggy|zomato|pizza|cafe|coffee|snack|meal|hotel|biryani)\b/],
    ['Transport',  /\b(transport|taxi|uber|ola|bus|train|metro|fuel|petrol|diesel|auto|cab|travel|flight|ticket|parking)\b/],
    ['Shopping',   /\b(shopping|amazon|flipkart|myntra|meesho|buy|purchase|cloth|clothes|shirt|shoes|fashion)\b/],
    ['Health',     /\b(health|medicine|medical|doctor|hospital|pharmacy|clinic|chemist|tablet|injection)\b/],
    ['Bills',      /\b(bill|bills|electricity|water|rent|internet|wifi|mobile|phone|recharge|emi|subscription|netflix|hotstar|spotify|insurance)\b/],
    ['Income',     /\b(salary|paycheck|payslip|bonus|freelance|client|payment received|stipend|dividend)\b/],
  ];
  let categoryHint = null;
  for (const [cat, regex] of CATS) {
    if (regex.test(lower)) { categoryHint = cat; break; }
  }

  // ── Extract clean description ──
  // Remove the amount, currency symbols, common filler words
  let description = lower
    .replace(/(\d+(?:\.\d{1,2})?)/, '')
    .replace(/\b(expense|income|spent|spend|paid|pay|received|receive|got|on|for|to|rs|inr|₹|\$|usd)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!description) description = categoryHint || (type === 'income' ? 'Income' : 'Expense');
  else description = description.charAt(0).toUpperCase() + description.slice(1);

  return { cmd: 'transaction', type, amount, description, categoryHint };
}

// ── POST /api/whatsapp/webhook ────────────────────────────────────────────────
const webhook = async (req, res) => {
  // Respond 200 immediately — Twilio retries if we don't
  res.status(200).set('Content-Type', 'text/xml').send('<Response></Response>');

  try {
    const from = (req.body.From || '').trim();          // "whatsapp:+91XXXXXXXXXX"
    const body = (req.body.Body || '').trim();

    if (!from || !body) return;

    // Normalise phone — strip "whatsapp:" prefix
    const phone = from.replace(/^whatsapp:/i, '');

    // ── Find user by phone ──
    const userRes = await query(
      'SELECT id, first_name, currency FROM users WHERE whatsapp_phone = $1',
      [phone]
    );

    if (!userRes.rows.length) {
      await sendReply(from,
        `👋 Hi! Your number *${phone}* isn't linked to any Tracksy account yet.\n\n` +
        `Open the *Tracksy app* → Settings → WhatsApp Integration and save this number to get started.`
      );
      return;
    }

    const user = userRes.rows[0];
    const parsed = parseMessage(body);

    // ── Unrecognised message ──
    if (!parsed) {
      await sendReply(from,
        `❓ I didn't understand that. Try:\n\n` +
        `• *100* → log ₹100 expense\n` +
        `• *150 food* → expense with category\n` +
        `• *received 5000 salary* → income\n` +
        `• *balance* → see accounts\n` +
        `• *help* → all commands`
      );
      return;
    }

    // ── HELP ──
    if (parsed.cmd === 'help') {
      await sendReply(from,
        `📱 *Tracksy — WhatsApp Commands*\n\n` +
        `*Expense (default):*\n` +
        `100\n` +
        `100 food\n` +
        `spent 250 on groceries\n` +
        `paid 500 rent\n\n` +
        `*Income:*\n` +
        `received 50000 salary\n` +
        `income 1000\n` +
        `got 200 refund\n\n` +
        `*Other:*\n` +
        `balance → view account balances\n` +
        `help → this message`
      );
      return;
    }

    // ── BALANCE ──
    if (parsed.cmd === 'balance') {
      const wallets = await query(
        `SELECT name, balance, type FROM wallets WHERE user_id = $1 ORDER BY is_default DESC, balance DESC LIMIT 6`,
        [user.id]
      );
      if (!wallets.rows.length) {
        await sendReply(from, `💳 You have no accounts yet. Open the Tracksy app to add one.`);
        return;
      }
      const ICONS = { visa:'💳', mastercard:'💳', bank:'🏦', cash:'💵', paypal:'🅿️', crypto:'₿', loan:'📋', asset:'📈', lending:'🤝', other:'👛' };
      const lines = wallets.rows.map(w => {
        const icon = ICONS[w.type] || '👛';
        const bal  = parseFloat(w.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        return `${icon} ${w.name}: *${bal}*`;
      }).join('\n');
      await sendReply(from, `💰 *Your Accounts*\n\n${lines}`);
      return;
    }

    // ── TRANSACTION ──
    const { type, amount, description, categoryHint } = parsed;

    // Get default wallet
    const walletRes = await query(
      `SELECT id, name FROM wallets WHERE user_id = $1 ORDER BY is_default DESC, created_at ASC LIMIT 1`,
      [user.id]
    );
    const walletId   = walletRes.rows[0]?.id   || null;
    const walletName = walletRes.rows[0]?.name || 'Default Account';

    // Match category (user's own first, then system defaults)
    let categoryId = null;
    if (categoryHint) {
      const catRes = await query(
        `SELECT id FROM categories WHERE (user_id = $1 OR user_id IS NULL) AND name ILIKE $2 ORDER BY (user_id = $1) DESC LIMIT 1`,
        [user.id, `%${categoryHint}%`]
      );
      categoryId = catRes.rows[0]?.id || null;
    }

    // Insert transaction
    await query(`
      INSERT INTO transactions
        (user_id, wallet_id, category_id, type, amount, description, payment_name, status, transaction_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', NOW())
    `, [user.id, walletId, categoryId, type, amount, description, `via WhatsApp`]);

    // Update wallet balance
    if (walletId) {
      const sign = type === 'income' ? '+' : '-';
      await query(`UPDATE wallets SET balance = balance ${sign} $1 WHERE id = $2`, [amount, walletId]);
    }

    // Format reply
    const sign  = type === 'income' ? '+' : '-';
    const emoji = type === 'income' ? '💚' : '🔴';
    const amtFormatted = parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 });

    await sendReply(from,
      `${emoji} *${type.charAt(0).toUpperCase() + type.slice(1)} logged!*\n\n` +
      `💵 Amount: *${sign}${amtFormatted}*\n` +
      `📝 ${description}\n` +
      `💳 Account: ${walletName}\n` +
      (categoryHint ? `🏷 Category: ${categoryHint}\n` : '') +
      `\nView details in Tracksy ✨`
    );

  } catch (err) {
    console.error('WhatsApp webhook error:', err);
  }
};

// ── PUT /api/whatsapp/phone — save phone from app ─────────────────────────────
const savePhone = async (req, res) => {
  try {
    const { whatsapp_phone } = req.body;
    // Normalise: ensure it starts with +
    const phone = whatsapp_phone?.replace(/[^\d+]/g, '').replace(/^([^+])/, '+$1') || null;

    await query(
      `UPDATE users SET whatsapp_phone = $1, updated_at = NOW() WHERE id = $2`,
      [phone, req.user.userId]
    );
    res.json({ success: true, whatsapp_phone: phone });
  } catch (err) {
    if (err.code === '23505') { // unique violation
      return res.status(409).json({ success: false, message: 'This number is already linked to another account' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { webhook, savePhone };
