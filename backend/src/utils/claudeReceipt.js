/* Claude (Anthropic) receipt reader.
   Sends a shared payment screenshot / receipt image to Claude's vision model
   and gets back structured fields — same shape as geminiReceipt so it's a
   drop-in. Returns { readable, amount, type, merchant, date, ref, source } or
   throws so the caller can fall back to Gemini / OCR.

   Requires ANTHROPIC_API_KEY. Model is Claude Haiku 4.5 (vision, cheap, fast,
   no forced thinking) — override with CLAUDE_RECEIPT_MODEL. */

const Anthropic = require('@anthropic-ai/sdk');
const sharp = require('sharp');

const MODEL = process.env.CLAUDE_RECEIPT_MODEL || 'claude-haiku-4-5';

async function shrink(buffer) {
  try {
    const meta = await sharp(buffer).metadata();
    const out = await sharp(buffer)
      .resize({ width: 1500, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return { data: out.toString('base64'), media: 'image/jpeg' };
  } catch {
    return { data: buffer.toString('base64'), media: 'image/jpeg' };
  }
}

const PROMPT =
  'You are reading a payment receipt or UPI payment screenshot (Paytm, Google Pay, ' +
  'PhonePe, Amazon Pay, a bank app, or a paper bill). Extract the transaction details. ' +
  'A shared payment receipt is normally money the user SENT, so default type to "expense" ' +
  'unless the screen clearly says the money was received/credited. Amount is numbers only ' +
  '(strip currency symbols and commas). ' +
  'Respond with ONLY a JSON object (no prose, no code fences) with exactly these keys: ' +
  '{"readable": boolean (true only if this is a payment receipt with a readable amount), ' +
  '"amount": number, "type": "expense" | "income", "merchant": string (who was paid / who ' +
  'sent money; "" if unknown), "date": string (YYYY-MM-DD, "" if not shown), "ref": string ' +
  '(UPI/transaction/order id, "" if none), "source": "paytm" | "phonepe" | "gpay" | ' +
  '"amazon_pay" | "upi" | "other"}. If the image is not a payment receipt or has no ' +
  'readable amount, set readable to false.';

function extractJson(text) {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

/* Read a receipt image with Claude → parsed fields, or null if unreadable. */
async function readReceiptWithClaude(buffer) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const client = new Anthropic({ apiKey });
  const { data, media } = await shrink(buffer);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: media, data } },
        { type: 'text', text: PROMPT },
      ],
    }],
  });

  const textBlock = (response.content || []).find(b => b.type === 'text');
  const parsed = extractJson(textBlock && textBlock.text);
  if (!parsed || parsed.readable === false || !parsed.amount) return null;

  return {
    amount:   Math.abs(parseFloat(parsed.amount)) || 0,
    type:     parsed.type === 'income' ? 'income' : 'expense',
    merchant: (parsed.merchant || '').toString().trim(),
    date:     (parsed.date || '').toString().trim(),
    ref:      (parsed.ref || '').toString().trim(),
    source:   parsed.source || 'other',
  };
}

module.exports = { readReceiptWithClaude };
