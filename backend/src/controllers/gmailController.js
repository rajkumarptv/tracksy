const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const { query } = require('../db');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5000';
const REDIRECT_URI = `${FRONTEND_URL}/api/gmail/callback`;
const GMAIL_SCOPE  = 'https://www.googleapis.com/auth/gmail.readonly';

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
}

async function isPremium(userId) {
  const r = await query('SELECT is_premium, premium_expires_at FROM users WHERE id=$1', [userId]);
  const u = r.rows[0];
  if (!u || !u.is_premium) return false;
  if (u.premium_expires_at && new Date(u.premium_expires_at) < new Date()) return false;
  return true;
}

/* ══════════════════════════════════════════════════════════════════════════
   EMAIL PARSER — best-effort extraction of bank / UPI transaction emails
══════════════════════════════════════════════════════════════════════════ */

// Senders/keywords that indicate a transaction alert (covers x.bank.in domains)
const TXN_SENDERS = /hdfc|icici|axis|sbi|kotak|yes\.?bank|paytm|phonepe|google|gpay|amazon|idfc|indusind|federal|rbl|aubank|bank\.in/i;

// Pretty-print a UPI handle like "bajajpay.6879729.cioig72p@indus" → "Bajajpay"
function cleanVpa(handle) {
  let h = (handle || '').split('@')[0];          // drop @bank
  h = h.replace(/[.\-_]\d.*$/, '');              // drop from first .digit onward
  h = h.replace(/[._-]+/g, ' ').trim();          // separators → space
  if (/^\d+$/.test(h)) return '';                // pure number (phone) → no name
  return h;
}

function titleCase(s) {
  return (s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).trim().slice(0, 50);
}

// Guess a category name from merchant + email text
function detectCategory(text, isDebit) {
  const t = (text || '').toLowerCase();
  if (!isDebit) {
    if (/salary|payroll|stipend/.test(t))            return 'Salary';
    if (/freelance|invoice|payment received/.test(t))return 'Freelance';
    if (/interest|dividend/.test(t))                 return 'Investment';
    if (/refund|cashback|reversal/.test(t))          return 'Other Income';
    return 'Other Income';
  }
  if (/swiggy|zomato|restaurant|cafe|hotel|food|pizza|domino|kfc|biryani|bakery|mess|tea|coffee|juice|sweets|mittai|catering/.test(t)) return 'Food & Dining';
  if (/super ?market|grocery|kirana|provision|store|agencies|fruits|vegetable|dmart|reliance fresh|kaikani/.test(t)) return 'Food & Dining';
  if (/fuel|petrol|diesel|indianoil|hpcl|bpcl|shell|cng|sri sathya|sri vignesh/.test(t)) return 'Transport';
  if (/redbus|ola|uber|rapido|metro|irctc|railway|bus|train|flight|indigo|spicejet|travel|web upi/.test(t)) return 'Transport';
  if (/airtel|jio|vodafone|\bvi\b|bsnl|recharge|electricity|tangedco|tneb|broadband|gas|water|dth|bill/.test(t)) return 'Bills & Utilities';
  if (/flipkart|amazon|meesho|myntra|ajio|nykaa|shopping|textiles|readymade|store/.test(t)) return 'Shopping';
  if (/hospital|clinic|pharmacy|medical|doctor|apollo|health|salon|bridal/.test(t)) return 'Health';
  if (/school|college|tuition|fees|course|coaching|superking|ventures/.test(t)) return 'Education';
  if (/credit card|cred|sbi card|billpay|card payment/.test(t)) return 'Bills & Utilities';
  if (/google play|netflix|spotify|prime|hotstar|entertainment|zarivault/.test(t)) return 'Entertainment';
  return null; // leave uncategorized rather than guess wrong
}

function parseTxnEmail({ subject, from, body, snippet }) {
  const text = `${subject || ''}\n${snippet || ''}\n${body || ''}`;

  const isDebit  = /\b(debited|spent|paid|sent|purchase|withdrawn|deducted)\b/i.test(text);
  const isCredit = /\b(credited|received|deposited|refund)\b/i.test(text);
  if (!isDebit && !isCredit) return null;

  // Amount
  const amtMatch = text.match(/(?:Rs\.?|INR|₹)\s?([\d,]+(?:\.\d{1,2})?)/i);
  if (!amtMatch) return null;
  const amount = parseFloat(amtMatch[1].replace(/,/g, ''));
  if (!amount || amount <= 0) return null;

  const type = isCredit && !isDebit ? 'income' : 'expense';

  // Merchant / counterparty — priority order
  let merchant = '';

  // 1) "VPA handle (NAME)" → prefer the name in parentheses
  let m = text.match(/VPA\s+[a-zA-Z0-9.@_-]+\s*\(([^)]{2,40})\)/i);
  if (m) merchant = m[1].trim();

  // 2) "towards VPA handle" → clean the handle
  if (!merchant) {
    m = text.match(/VPA\s+([a-zA-Z0-9.@_-]{3,50})/i);
    if (m) merchant = cleanVpa(m[1]);
  }

  // 3) "credited to / debited to <NAME>"
  if (!merchant) {
    m = text.match(/(?:credited to|debited to|paid to|sent to)\s+(?:VPA\s+)?([A-Za-z][A-Za-z0-9 &._-]{2,40})/i);
    if (m) merchant = m[1].trim();
  }

  // 4) generic "at/to <NAME>"
  if (!merchant) {
    m = text.match(/\b(?:at|to|towards)\s+([A-Z][A-Za-z0-9 &._-]{2,40})/);
    if (m) merchant = m[1].trim();
  }

  // Strip trailing boilerplate words
  merchant = merchant.replace(/\b(on|info|ref|upi|a\/c|account|your|dated|towards|is|has|was|the)\b.*$/i, '').trim();

  // Fallbacks: a credit with no name → "Bank Credit"; else bank name
  if (!merchant || merchant.length < 2) {
    const bank = (from || '').match(/hdfc|icici|axis|sbi|kotak|yes|paytm|phonepe|gpay|google|amazon|idfc|indusind|federal|rbl/i);
    merchant = type === 'income'
      ? (bank ? `${bank[0].toUpperCase()} Credit` : 'Bank Credit')
      : (bank ? `${bank[0].toUpperCase()} Payment` : 'Bank Payment');
  } else {
    merchant = titleCase(merchant);
  }

  const ref = (text.match(/(?:UPI Ref(?:erence)? (?:No\.?|number)?|Ref(?:erence)? No\.?|txn id)[:\s]*([A-Za-z0-9]{6,})/i) || [])[1] || null;

  // Category from the MERCHANT name only (full body is too noisy → false matches).
  // Person-to-person transfers stay uncategorized, which is correct.
  const category = detectCategory(merchant, type === 'expense');

  return { amount, type, merchant, ref, category };
}

// Decode a Gmail message body (base64url, possibly multipart)
function extractBody(payload) {
  if (!payload) return '';
  let out = '';
  const walk = (part) => {
    if (!part) return;
    if (part.body?.data && (part.mimeType === 'text/plain' || part.mimeType === 'text/html')) {
      const buf = Buffer.from(part.body.data, 'base64').toString('utf-8');
      out += ' ' + buf.replace(/<[^>]+>/g, ' '); // strip HTML tags
    }
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  return out.replace(/\s+/g, ' ').slice(0, 4000);
}

/* ══════════════════════════════════════════════════════════════════════════
   CORE SYNC — fetch recent txn emails, parse, insert (deduped)
   Returns { imported, scanned, skipped }
══════════════════════════════════════════════════════════════════════════ */
async function syncUserGmail(userId, { days = 7 } = {}) {
  const u = (await query(
    'SELECT gmail_refresh_token, gmail_connected FROM users WHERE id=$1', [userId]
  )).rows[0];
  if (!u?.gmail_connected || !u.gmail_refresh_token) {
    throw Object.assign(new Error('Gmail not connected'), { code: 'NOT_CONNECTED' });
  }

  const auth = oauthClient();
  auth.setCredentials({ refresh_token: u.gmail_refresh_token });
  const gmail = google.gmail({ version: 'v1', auth });

  // Load this user's categories once → map detected name → id
  const catRows = (await query(
    'SELECT id, name, type FROM categories WHERE user_id=$1 OR is_default=true', [userId]
  )).rows;
  const findCatId = (name, txType) => {
    if (!name) return null;
    const lc = name.toLowerCase();
    const match = catRows.find(c =>
      c.name.toLowerCase() === lc && (c.type === txType || c.type === 'both'))
      || catRows.find(c => c.name.toLowerCase() === lc);
    return match?.id || null;
  };

  // Search query: bank/UPI alerts in the last N days
  const q = `newer_than:${days}d (debited OR credited OR "UPI" OR "spent" OR "received") (Rs OR INR OR "₹")`;
  const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: 50 });
  const messages = list.data.messages || [];

  let imported = 0, skipped = 0;

  for (const { id } of messages) {
    // Already imported?
    const exists = (await query(
      'SELECT 1 FROM transactions WHERE user_id=$1 AND external_id=$2', [userId, id]
    )).rows.length > 0;
    if (exists) { skipped++; continue; }

    const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const headers = msg.data.payload?.headers || [];
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const from    = headers.find(h => h.name === 'From')?.value || '';
    const snippet = msg.data.snippet || '';
    const body    = extractBody(msg.data.payload);

    // Only consider likely bank/UPI senders
    if (!TXN_SENDERS.test(from) && !TXN_SENDERS.test(subject)) { skipped++; continue; }

    const parsed = parseTxnEmail({ subject, from, body, snippet });
    if (!parsed) { skipped++; continue; }

    const dateISO = new Date(parseInt(msg.data.internalDate)).toISOString().split('T')[0];

    const categoryId = findCatId(parsed.category, parsed.type);

    try {
      await query(`
        INSERT INTO transactions
          (user_id, type, amount, description, payment_name, category_id, status, transaction_date, external_id)
        VALUES ($1,$2,$3,$4,$5,$6,'completed',$7,$8)
        ON CONFLICT (user_id, external_id) WHERE external_id IS NOT NULL DO NOTHING
      `, [userId, parsed.type, parsed.amount, parsed.merchant,
          parsed.ref || 'Gmail import', categoryId, dateISO, id]);
      imported++;
    } catch (e) { skipped++; }
  }

  await query('UPDATE users SET gmail_last_sync=NOW() WHERE id=$1', [userId]);
  return { imported, scanned: messages.length, skipped };
}

/* ══════════════════════════════════════════════════════════════════════════
   ROUTES
══════════════════════════════════════════════════════════════════════════ */

// GET /api/gmail/connect  → redirect user to Google consent
const connect = (req, res) => {
  // token passed as query (?token=) since this is a top-level browser redirect
  const token = req.query.token;
  if (!token) return res.status(401).send('Missing token');
  let userId;
  try { userId = jwt.verify(token, process.env.JWT_SECRET).userId; }
  catch { return res.status(401).send('Invalid token'); }

  const auth = oauthClient();
  const url = auth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',                 // force refresh_token every time
    scope: [GMAIL_SCOPE],
    state: jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '10m' }),
  });
  res.redirect(url);
};

// GET /api/gmail/callback  → exchange code, store refresh token
const callback = async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.redirect(`${FRONTEND_URL}/settings?gmail=error`);

    let userId;
    try { userId = jwt.verify(state, process.env.JWT_SECRET).userId; }
    catch { return res.redirect(`${FRONTEND_URL}/settings?gmail=error`); }

    const auth = oauthClient();
    const { tokens } = await auth.getToken(code);

    if (!tokens.refresh_token) {
      // No refresh token (user previously authorized) — still mark connected if we got access
      await query('UPDATE users SET gmail_connected=true WHERE id=$1', [userId]);
    } else {
      await query(
        'UPDATE users SET gmail_refresh_token=$1, gmail_connected=true, gmail_sync_enabled=true WHERE id=$2',
        [tokens.refresh_token, userId]
      );
    }
    res.redirect(`${FRONTEND_URL}/settings?gmail=connected`);
  } catch (err) {
    console.error('Gmail callback error:', err.message);
    res.redirect(`${FRONTEND_URL}/settings?gmail=error`);
  }
};

// GET /api/gmail/status
const status = async (req, res) => {
  try {
    const u = (await query(
      'SELECT gmail_connected, gmail_sync_enabled, gmail_last_sync FROM users WHERE id=$1',
      [req.user.userId]
    )).rows[0];
    res.json({ success:true, data: {
      connected:    !!u?.gmail_connected,
      sync_enabled: !!u?.gmail_sync_enabled,
      last_sync:    u?.gmail_last_sync || null,
      is_premium:   await isPremium(req.user.userId),
    }});
  } catch (err) {
    res.status(500).json({ success:false, message:'Server error' });
  }
};

// POST /api/gmail/sync  (manual trigger)
const syncNow = async (req, res) => {
  try {
    if (!(await isPremium(req.user.userId)))
      return res.status(403).json({ success:false, code:'FREE_LIMIT', message:'Gmail auto-import is a Premium feature.' });
    const result = await syncUserGmail(req.user.userId, { days: 30 });
    res.json({ success:true, data: result });
  } catch (err) {
    if (err.code === 'NOT_CONNECTED')
      return res.status(400).json({ success:false, message:'Connect Gmail first.' });
    console.error('Gmail sync error:', err.message);
    res.status(500).json({ success:false, message:'Sync failed. Try reconnecting Gmail.' });
  }
};

// POST /api/gmail/disconnect
const disconnect = async (req, res) => {
  try {
    await query(
      'UPDATE users SET gmail_refresh_token=NULL, gmail_connected=false, gmail_sync_enabled=false WHERE id=$1',
      [req.user.userId]
    );
    res.json({ success:true, message:'Gmail disconnected.' });
  } catch (err) {
    res.status(500).json({ success:false, message:'Server error' });
  }
};

// POST /api/gmail/toggle  { enabled }
const toggleSync = async (req, res) => {
  try {
    const enabled = !!req.body.enabled;
    await query('UPDATE users SET gmail_sync_enabled=$1 WHERE id=$2', [enabled, req.user.userId]);
    res.json({ success:true, data: { sync_enabled: enabled } });
  } catch (err) {
    res.status(500).json({ success:false, message:'Server error' });
  }
};

module.exports = { connect, callback, status, syncNow, disconnect, toggleSync, syncUserGmail };
