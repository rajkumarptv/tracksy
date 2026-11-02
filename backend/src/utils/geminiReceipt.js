/* Gemini-based receipt reader.
   Sends a payment screenshot / receipt image straight to Gemini's vision model
   and gets back the structured fields — no OCR, no regex. Free-tier friendly
   (gemini-2.5-flash). Returns { amount, type, merchant, date, ref, source } or
   null if the model couldn't read a valid payment.

   Requires GEMINI_API_KEY in the environment. If the key is missing or the
   call fails, this throws so the caller can fall back to the Tesseract path. */

const sharp = require('sharp');

/* Downscale big screenshots before upload: keeps requests small and fast, and
   a receipt is perfectly readable at ~1500px. Colour is kept — Gemini reads it
   fine, unlike the old grayscale-for-OCR trick. */
async function shrink(buffer) {
  try {
    return await sharp(buffer)
      .resize({ width: 1500, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch { return buffer; }
}

/* JSON shape we force Gemini to return — matches parseReceipt()'s output. */
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    readable: { type: 'boolean', description: 'true if this is a payment receipt/screenshot with a readable amount' },
    amount:   { type: 'number',  description: 'the transaction amount, numbers only' },
    type:     { type: 'string',  enum: ['expense', 'income'], description: 'expense if money was sent/paid, income if received/credited' },
    merchant: { type: 'string',  description: 'who was paid or who sent the money; empty string if unknown' },
    date:     { type: 'string',  description: 'transaction date as YYYY-MM-DD; empty string if not shown' },
    ref:      { type: 'string',  description: 'UPI/transaction/reference/order id; empty string if none' },
    source:   { type: 'string',  enum: ['paytm', 'phonepe', 'gpay', 'amazon_pay', 'upi', 'other'], description: 'the app the receipt is from' },
  },
  required: ['readable', 'amount', 'type', 'merchant', 'date', 'ref', 'source'],
};

const PROMPT =
  'You are reading a payment receipt or UPI payment screenshot (Paytm, Google Pay, ' +
  'PhonePe, Amazon Pay, a bank app, or a paper bill). Extract the transaction details. ' +
  'A shared payment receipt is normally money the user SENT, so default type to "expense" ' +
  'unless the screen clearly says the money was received/credited. Amount is numbers only ' +
  '(strip currency symbols and commas). If the image is not a payment receipt or has no ' +
  'readable amount, set readable to false.';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* Models tried in order. 'gemini-flash-latest' auto-tracks the current free
   Flash model; 'gemini-flash-lite-latest' is lighter with more free-tier
   headroom — a good fallback when Flash is overloaded (503). */
const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

/* Gemini's free tier returns 503 UNAVAILABLE ("high demand") or 429 under load.
   These are transient — retry with backoff, and try the lite model, before
   giving up. Non-transient errors (bad key, bad request) throw immediately. */
async function generateWithRetry(ai, contents, config) {
  // Vercel Hobby kills the function at 10s. Gemini is only a fallback behind
  // Claude now, so keep the whole budget tiny: one quick attempt per model, a
  // short backoff, and no long retry storm that would 504 before returning.
  let lastErr;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({ model, contents, config });
      } catch (e) {
        lastErr = e;
        const msg = String((e && e.message) || e);
        const transient = /\b(429|500|503)\b|UNAVAILABLE|overloaded|high demand|rate.?limit/i.test(msg);
        if (!transient) throw e;                 // real error — don't waste retries
        if (attempt < 1) await sleep(400);       // one short retry only
      }
    }
    // this model kept failing transiently → fall through to the next model
  }
  throw lastErr;
}

/* Read a receipt image with Gemini → parsed fields, or null if unreadable. */
async function readReceiptWithGemini(buffer) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const img = await shrink(buffer);

  const contents = [{
    role: 'user',
    parts: [
      { inlineData: { mimeType: 'image/jpeg', data: img.toString('base64') } },
      { text: PROMPT },
    ],
  }];
  const config = {
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA,
  };

  const response = await generateWithRetry(ai, contents, config);

  const data = JSON.parse(response.text);

  if (!data.readable || !data.amount || data.amount <= 0) return null;

  // Normalise into the exact shape parseReceipt() produces.
  const today = new Date().toISOString().split('T')[0];
  const source = data.source || 'upi';
  let merchant = (data.merchant || '').trim();
  if (!merchant) merchant = source === 'upi' ? 'UPI Payment' : `${source} payment`;

  return {
    amount:   Number(data.amount),
    type:     data.type === 'income' ? 'income' : 'expense',
    merchant: merchant.slice(0, 60),
    date:     /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : today,
    ref:      data.ref ? String(data.ref).trim() : null,
    source,
  };
}

module.exports = { readReceiptWithGemini };
