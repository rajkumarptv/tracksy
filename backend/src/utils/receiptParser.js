/* Parse OCR text from a UPI payment screenshot (Paytm / GPay / PhonePe).
   Returns { amount, type, merchant, date, ref, source } or null. */

const MONTHS = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
                 jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };

function parseReceipt(rawText) {
  const text = (rawText || '').replace(/\r/g, '');
  const lc   = text.toLowerCase();

  // ── Amount: ₹ / Rs / INR followed by a number ──
  const amtMatch =
       text.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i)
    || text.match(/\b([\d,]{2,})(?:\.\d{2})?\s*(?:paid|sent|received)/i);
  if (!amtMatch) return null;
  const amount = parseFloat(amtMatch[1].replace(/,/g, ''));
  if (!amount || amount <= 0) return null;

  // ── Source app ──
  let source = 'upi';
  if (/paytm/i.test(lc))   source = 'paytm';
  else if (/phonepe|phone pe/i.test(lc)) source = 'phonepe';
  else if (/google pay|gpay|g pay/i.test(lc)) source = 'gpay';
  else if (/amazon ?pay/i.test(lc)) source = 'amazon_pay';

  // ── Direction ──
  // A shared payment receipt is normally money you SENT → expense.
  const isIncome = /\b(received|credited|money received|request received)\b/i.test(lc)
                   && !/\bto:?\s/i.test(lc);
  const type = isIncome ? 'income' : 'expense';

  // ── Merchant / counterparty ──
  let merchant = '';
  let m =
       text.match(/(?:Paid to|To)\s*:?\s*([A-Z][A-Za-z0-9 .&'-]{2,40})/)
    || text.match(/(?:Received from|From)\s*:?\s*([A-Z][A-Za-z0-9 .&'-]{2,40})/);
  if (m) merchant = m[1].trim();
  // cut trailing labels that OCR may glue on
  merchant = merchant.replace(/\b(upi|bank|ref|paid|from|to|id)\b.*$/i, '').trim();
  if (!merchant) merchant = source === 'upi' ? 'UPI Payment' : `${source} payment`;
  merchant = merchant.charAt(0).toUpperCase() + merchant.slice(1, 50);

  // ── Reference number ──
  const ref = (text.match(/(?:Ref(?:erence)?\.?\s*(?:No\.?|number)?|UPI (?:transaction|txn) ID|Transaction ID|Order ID)\s*[:\-]?\s*([A-Za-z0-9]{6,})/i) || [])[1] || null;

  // ── Date (e.g. "07 Jun, 12:23 PM" or "07 Jun 2026" or "Jun 07") ──
  let date = null;
  let d = text.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?(?:\s*,?\s*(\d{4}))?/);
  if (d && MONTHS[d[2].toLowerCase()]) {
    const yr = d[3] || new Date().getFullYear();
    date = `${yr}-${MONTHS[d[2].toLowerCase()]}-${d[1].padStart(2,'0')}`;
  } else {
    d = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (d) { const y = d[3].length===2?'20'+d[3]:d[3]; date = `${y}-${d[2].padStart(2,'0')}-${d[1].padStart(2,'0')}`; }
  }
  if (!date) date = new Date().toISOString().split('T')[0];

  return { amount, type, merchant, date, ref, source };
}

module.exports = { parseReceipt };
