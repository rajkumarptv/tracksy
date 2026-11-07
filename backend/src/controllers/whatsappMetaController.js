const { query } = require('../db');
const { parseReceipt } = require('../utils/receiptParser');
const { readReceiptWithGemini } = require('../utils/geminiReceipt');
const { verifyMetaSignature } = require('../utils/security');

const GRAPH = 'https://graph.facebook.com/v21.0';
const TOKEN     = () => process.env.META_WA_TOKEN;
const PHONE_ID  = () => process.env.META_WA_PHONE_ID;
const VERIFY    = () => process.env.META_WA_VERIFY_TOKEN;

/* ── Send a WhatsApp text reply via Meta Graph API ── */
async function sendReply(to, body) {
  if (!TOKEN() || !PHONE_ID()) return;
  try {
    await fetch(`${GRAPH}/${PHONE_ID()}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product:'whatsapp', to, type:'text', text:{ body } }),
    });
  } catch (e) { console.error('WA send error:', e.message); }
}

/* ── Download a media file (image) from Meta by media id ── */
async function downloadMedia(mediaId) {
  const meta = await (await fetch(`${GRAPH}/${mediaId}`, {
    headers: { 'Authorization': `Bearer ${TOKEN()}` },
  })).json();
  if (!meta.url) throw new Error('No media URL');
  const res = await fetch(meta.url, { headers: { 'Authorization': `Bearer ${TOKEN()}` } });
  return Buffer.from(await res.arrayBuffer());
}

/* ── OCR an image buffer → text ── */
async function ocrImage(buffer) {
  const { createWorker } = require('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const { data } = await worker.recognize(buffer);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

/* ── Guess a category from merchant text ── */
function guessCategory(text, isDebit) {
  const t = (text || '').toLowerCase();
  if (!isDebit) return 'Other Income';
  if (/swiggy|zomato|restaurant|cafe|hotel|food|pizza|bakery|tea|coffee|mess/.test(t)) return 'Food & Dining';
  if (/super ?market|grocery|kirana|store|mart|agencies|vegetable|fruit/.test(t)) return 'Food & Dining';
  if (/fuel|petrol|diesel|cng|indianoil|hpcl|bpcl/.test(t)) return 'Transport';
  if (/ola|uber|rapido|irctc|redbus|bus|train|metro|travel/.test(t)) return 'Transport';
  if (/airtel|jio|recharge|electricity|bill|gas|water|dth|broadband/.test(t)) return 'Bills & Utilities';
  if (/amazon|flipkart|myntra|meesho|ajio|shopping/.test(t)) return 'Shopping';
  if (/hospital|pharmacy|medical|clinic|doctor|health/.test(t)) return 'Health';
  return null;
}

/* ── GET /api/whatsapp/meta/webhook — verification handshake ── */
const verify = (req, res) => {
  const mode  = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY()) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
};

/* ── POST /api/whatsapp/meta/webhook — receive messages ── */
const receive = async (req, res) => {
  // Only Meta may post here: it signs the raw body with the app secret. Without this check anyone could
  // forge a message "from" a linked phone number and add transactions to that account.
  const secret = process.env.META_WA_APP_SECRET;
  if (!secret) {
    console.error('[wa] META_WA_APP_SECRET is not set; refusing webhook calls. Set it to your Meta app secret.');
    return res.sendStatus(503);
  }
  if (!verifyMetaSignature(req.rawBody, req.get('x-hub-signature-256'), secret)) return res.sendStatus(403);
  res.sendStatus(200); // ack immediately

  try {
    const entry  = req.body.entry?.[0]?.changes?.[0]?.value;
    const msg    = entry?.messages?.[0];
    if (!msg) return;

    const from = msg.from;                          // sender phone, e.g. "9198..."
    const phone = '+' + from.replace(/^\+/, '');

    // Find the linked Tracksy user
    const userRes = await query(
      'SELECT id, first_name FROM users WHERE whatsapp_phone = $1 OR whatsapp_phone = $2',
      [phone, from]
    );
    if (!userRes.rows.length) {
      await sendReply(from, `👋 This number isn't linked to a Tracksy account yet.\nOpen Tracksy → Settings → WhatsApp and save this number.`);
      return;
    }
    const user = userRes.rows[0];

    let parsed = null;
    let caption = null;   // category typed under the screenshot

    if (msg.type === 'image') {
      // Screenshot → Gemini vision → parse. Caption (if any) = category.
      caption = (msg.image.caption || '').trim() || null;
      const buf  = await downloadMedia(msg.image.id);
      try {
        parsed = await readReceiptWithGemini(buf);
      } catch (gemErr) {
        console.warn('[wa] gemini unavailable, OCR fallback:', gemErr.message);
        parsed = parseReceipt(await ocrImage(buf));
      }
      if (!parsed) {
        await sendReply(from, `📷 I couldn't read that screenshot. Make sure the amount and recipient are clearly visible, or type it like: "paid 250 swiggy".`);
        return;
      }
    } else if (msg.type === 'text') {
      // Simple text like "paid 250 swiggy"
      const body = msg.text.body || '';
      const amt = body.match(/([\d,]+(?:\.\d{1,2})?)/);
      if (!amt) { await sendReply(from, `Type an amount, e.g. "paid 250 swiggy" — or just forward a payment screenshot.`); return; }
      const isInc = /\b(received|got|credited|salary|refund|income)\b/i.test(body);
      const merchant = body.replace(/([\d,]+(?:\.\d{1,2})?)/,'').replace(/\b(paid|to|for|rs|inr|₹|spent|received|got)\b/gi,'').trim() || 'WhatsApp entry';
      parsed = { amount: parseFloat(amt[1].replace(/,/g,'')), type: isInc?'income':'expense',
                 merchant: merchant.charAt(0).toUpperCase()+merchant.slice(1,50),
                 date: new Date().toISOString().split('T')[0], ref:null, source:'whatsapp' };
    } else {
      return;
    }

    // Dedup by ref
    if (parsed.ref) {
      const dup = await query('SELECT 1 FROM transactions WHERE user_id=$1 AND external_id=$2', [user.id, `wa_${parsed.ref}`]);
      if (dup.rows.length) { await sendReply(from, `✓ Already logged (ref ${parsed.ref}).`); return; }
    }

    // Resolve category — caption wins, else auto-guess
    let catName = caption || guessCategory(parsed.merchant, parsed.type === 'expense');
    let categoryId = null;
    if (catName) {
      // Try to match an existing category (user's own first, then defaults)
      const c = await query(
        'SELECT id, name FROM categories WHERE (user_id=$1 OR is_default=true) AND name ILIKE $2 ORDER BY (user_id=$1) DESC LIMIT 1',
        [user.id, catName]
      );
      if (c.rows.length) {
        categoryId = c.rows[0].id;
        catName    = c.rows[0].name;   // use the canonical name
      } else if (caption) {
        // Caption is a brand-new category → create it for this user
        const created = await query(
          `INSERT INTO categories (user_id, name, type, emoji, color, is_default)
           VALUES ($1,$2,$3,'🏷️','#6C63FF',false) RETURNING id, name`,
          [user.id, caption.slice(0,40), parsed.type === 'income' ? 'income' : 'expense']
        );
        categoryId = created.rows[0].id;
        catName    = created.rows[0].name;
      }
    }

    // Default wallet
    const w = await query('SELECT id FROM wallets WHERE user_id=$1 ORDER BY is_default DESC, created_at LIMIT 1', [user.id]);
    const walletId = w.rows[0]?.id || null;

    await query(`
      INSERT INTO transactions (user_id, wallet_id, category_id, type, amount, description, payment_name, status, transaction_date, external_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',$8,$9)
    `, [user.id, walletId, categoryId, parsed.type, parsed.amount, parsed.merchant,
        `via WhatsApp (${parsed.source})`, parsed.date, parsed.ref ? `wa_${parsed.ref}` : null]);

    const sign = parsed.type === 'income' ? '+' : '−';
    await sendReply(from,
      `✅ Saved!\n\n` +
      `${sign}₹${parsed.amount}  ·  ${parsed.merchant}\n` +
      `📅 ${parsed.date}\n` +
      `🏷 ${catName || 'Uncategorized'}\n` +
      `\nEdit or recategorize anytime in Tracksy.`
    );
  } catch (err) {
    console.error('WA Meta webhook error:', err.message);
  }
};

module.exports = { verify, receive };
