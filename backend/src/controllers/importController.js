const { query } = require('../db');
// Require the inner lib directly — pdf-parse's index.js runs debug code at
// load time that reads a bundled test PDF (`./test/data/…`), which throws
// ENOENT in serverless bundles. The lib entry skips that wrapper.
const pdfParse  = require('pdf-parse/lib/pdf-parse.js');
const XLSX      = require('xlsx');

/* Extract text from a (possibly password-protected) PDF. pdf-parse's
   getDocument accepts a { data, password } source, so we reuse it (it already
   loads pdfjs correctly). Throws e.needsPassword when the PDF is encrypted and
   no/incorrect password was supplied. */
async function extractPdfText(buffer, password) {
  try {
    const src = password ? { data: buffer, password } : buffer;
    const data = await pdfParse(src);
    return data.text;
  } catch (err) {
    const msg = (err && (err.name || err.message) || '').toString();
    if (/password/i.test(msg) || err?.name === 'PasswordException') {
      const e = new Error(password ? 'Incorrect password' : 'This PDF is password protected');
      e.needsPassword = true;
      e.incorrect = !!password;
      throw e;
    }
    throw err;
  }
}

/* ══════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════ */
function toTitleCase(str) {
  return (str || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).trim();
}

function parseAmount(raw) {
  // Strip currency words FIRST — "Rs." leaves a stray dot that turns
  // "Rs.540" into ".540" → 0.54 if removed naively.
  return parseFloat(
    (raw || '0').toString()
      .replace(/rs\.?/gi, '')
      .replace(/inr/gi, '')
      .replace(/[₹,\s()]/g, '')
  ) || 0;
}

function normalizeDate(raw) {
  if (!raw) return null;
  const s = raw.trim();

  // DD/MM/YY or DD/MM/YYYY
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const d = m[1].padStart(2,'0'), mo = m[2].padStart(2,'0');
    const y = m[3].length === 2 ? '20'+m[3] : m[3];
    return `${y}-${mo}-${d}`;
  }

  // "01 May 2026" or "01 May, 2026"
  m = s.match(/(\d{1,2})\s+([A-Za-z]+)[,\s]+(\d{4})/);
  if (m) {
    const months = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
    const mo = months[m[2].toLowerCase().slice(0,3)];
    return mo ? `${m[3]}-${mo}-${m[1].padStart(2,'0')}` : null;
  }

  // "May 01, 2026" or "May 1 2026"
  m = s.match(/([A-Za-z]+)\s+(\d{1,2})[,\s]+(\d{4})/);
  if (m) {
    const months = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
    const mo = months[m[1].toLowerCase().slice(0,3)];
    return mo ? `${m[3]}-${mo}-${m[2].padStart(2,'0')}` : null;
  }

  // ISO YYYY-MM-DD
  m = s.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  return null;
}

/* ── Smart narration cleaner ── */
function parseNarration(raw) {
  const n = (raw || '').trim();
  if (n.startsWith('UPI-')) {
    const parts = n.slice(4).split('-');
    let merchant = (parts[0] || '').replace(/^(MR\.?\s+|MRS\.?\s+|MS\.?\s+)/i,'').trim();
    const lastPart = parts[parts.length-1] || '';
    const hasDesc = lastPart && !/^\d{6,}$/.test(lastPart) && !/^(UPI|NA|SENT USING PAYTM|PAYMENT FROM PHONE)$/i.test(lastPart);
    return { merchant: toTitleCase(merchant), description: hasDesc ? toTitleCase(lastPart) : '' };
  }
  if (/^ACH D[- ]/.test(n)) {
    const match = n.match(/ACH D[- ]\s*([A-Z0-9& ]+?)[-\s]/i);
    return { merchant: toTitleCase(match?.[1]?.trim() || 'ACH Debit'), description: 'EMI / Loan Payment' };
  }
  if (/^IMPS-/.test(n)) {
    const parts = n.split('-');
    return { merchant: toTitleCase((parts[2]||'IMPS Transfer').trim()), description: 'IMPS Transfer' };
  }
  if (/^NEFT (CR|DR)-/.test(n)) {
    const parts = n.split('-');
    return { merchant: toTitleCase((parts[2]||'NEFT Transfer').trim()), description: 'NEFT Transfer' };
  }
  if (/^IB BILLPAY/i.test(n)) return { merchant: 'Credit Card Bill', description: 'Bill Payment' };
  return { merchant: toTitleCase(n.substring(0,40)), description: '' };
}

/* ── Category auto-detector ── */
function detectCategory(narration, merchant, isDebit) {
  const text = `${narration} ${merchant}`.toLowerCase();
  if (!isDebit) {
    if (/salary|payroll|stipend/i.test(text))     return 'Salary';
    if (/freelance|invoice|payment received/i.test(text)) return 'Freelance';
    if (/refund|return|cashback/i.test(text))      return 'Other Income';
    if (/interest|dividend/i.test(text))           return 'Investment';
    return 'Other Income';
  }
  if (/ach d|emi|loan|bajaj|hdfc loan|tata capital|fullerton/i.test(text)) return 'Bills & Utilities';
  if (/credit card|cred\.club|billpay/i.test(text)) return 'Bills & Utilities';
  if (/fuel|petrol|indian oil|shell|bpcl|hpcl|cng/i.test(text)) return 'Transport';
  if (/redbus|ola|uber|rapido|metro|irctc|taxi/i.test(text)) return 'Transport';
  if (/swiggy|zomato|domino|pizza|restaurant|cafe|food|mess|biryani/i.test(text)) return 'Food & Dining';
  if (/grocery|supermarket|kirana|provision|dmart|reliance fresh/i.test(text)) return 'Food & Dining';
  if (/airtel|jio|vi |vodafone|electricity|tneb|bescom|water bill|lpg/i.test(text)) return 'Bills & Utilities';
  if (/flipkart|amazon|meesho|myntra|ajio|nykaa|shoppers/i.test(text)) return 'Shopping';
  if (/hospital|clinic|pharmacy|medical|doctor|health|apollo/i.test(text)) return 'Health';
  if (/school|college|tuition|fees|course|coaching/i.test(text)) return 'Education';
  return 'Shopping';
}

/* ══════════════════════════════════════════════════════════════════
   PARSERS
══════════════════════════════════════════════════════════════════ */

/* ── HDFC Bank CSV ── */
function parseHDFCStatement(text) {
  const transactions = [];
  for (const line of text.split('\n')) {
    if (/Date\s*,Narration/i.test(line) || !line.trim()) continue;
    const cols = line.split(',');
    if (cols.length < 6) continue;
    const date   = normalizeDate(cols[0]?.trim());
    const narration = (cols[1]||'').trim();
    const debit  = parseAmount(cols[3]);
    const credit = parseAmount(cols[4]);
    const ref    = (cols[5]||'').trim();
    if (!date || !narration || (debit===0 && credit===0)) continue;
    const isDebit = debit > 0;
    const { merchant, description } = parseNarration(narration);
    transactions.push({
      date, narration: narration.substring(0,120), merchant,
      description: description || merchant,
      amount: isDebit ? debit : credit,
      type: isDebit ? 'expense' : 'income',
      category: detectCategory(narration, merchant, isDebit),
      ref_number: ref, source: 'hdfc',
    });
  }
  return transactions;
}

/* ── Paytm Wallet / Passbook CSV ──
   Columns: S.No., Date, Remarks, Type, Amount, Wallet Balance
   OR: Date,Description,Credit,Debit,Balance
*/
function parsePaytmStatement(text) {
  const transactions = [];
  const lines = text.split('\n').filter(l => l.trim());

  // Detect format by header
  const header = lines[0]?.toLowerCase() || '';
  const isFormat2 = header.includes('credit') && header.includes('debit');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Simple CSV split respecting quotes
    const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map(c => c.replace(/^"|"$/g,'').trim()) || line.split(',').map(c=>c.trim());
    if (cols.length < 3) continue;

    let date, description, amount, type;

    if (isFormat2) {
      // Date, Description, Credit, Debit, Balance
      date        = normalizeDate(cols[0]);
      description = cols[1] || '';
      const credit = parseAmount(cols[2]);
      const debit  = parseAmount(cols[3]);
      if (!date || (credit===0 && debit===0)) continue;
      const isDebit = debit > 0;
      amount = isDebit ? debit : credit;
      type   = isDebit ? 'expense' : 'income';
    } else {
      // S.No., Date, Remarks, Type, Amount, Balance
      date        = normalizeDate(cols[1]);
      description = cols[2] || '';
      const typeStr = (cols[3]||'').toLowerCase();
      amount      = parseAmount(cols[4]);
      if (!date || amount === 0) continue;
      const isDebit = typeStr.includes('debit') || typeStr.includes('paid') || typeStr.includes('sent');
      type = isDebit ? 'expense' : 'income';
    }

    const merchant = toTitleCase(description.replace(/^(Paid to|Received from|UPI-)\s*/i,'').split('-')[0].substring(0,40));
    transactions.push({
      date,
      narration: description.substring(0,120),
      merchant,
      description: description.substring(0,120),
      amount,
      type,
      category: detectCategory(description, merchant, type==='expense'),
      ref_number: null,
      source: 'paytm',
    });
  }
  return transactions;
}

/* ── PhonePe Statement CSV ──
   Formats vary; common:
   Transaction Date, Transaction ID, Remarks, Credit/Debit, Amount, Balance
   OR: Date, UPI Ref, Description, Type, Amount
*/
function parsePhonePeStatement(text) {
  const transactions = [];
  const lines = text.split('\n').filter(l => l.trim());

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map(c => c.replace(/^"|"$/g,'').trim()) || line.split(',').map(c=>c.trim());
    if (cols.length < 4) continue;

    // Try to find date (first col that looks like a date)
    let date = null, description = '', amount = 0, type = 'expense', ref = '';
    for (let j = 0; j < Math.min(cols.length, 3); j++) {
      const d = normalizeDate(cols[j]);
      if (d) { date = d; break; }
    }
    if (!date) continue;

    // Description is usually col index 2 or 3
    description = cols[2] || cols[1] || '';
    ref         = cols[1] || '';

    // Find amount — look for a numeric col
    for (let j = cols.length-1; j >= 2; j--) {
      const a = parseAmount(cols[j]);
      if (a > 0) { amount = a; break; }
    }
    if (amount === 0) continue;

    // Detect credit/debit
    const typeHint = cols.join(' ').toLowerCase();
    const isDebit  = typeHint.includes('debit') || typeHint.includes('paid') || typeHint.includes('dr');
    type = isDebit ? 'expense' : 'income';

    const merchant = toTitleCase(description.replace(/^(UPI-|Paid to |Received from )/i,'').split('-')[0].substring(0,40));
    transactions.push({
      date,
      narration: description.substring(0,120),
      merchant,
      description: description.substring(0,120),
      amount, type,
      category: detectCategory(description, merchant, isDebit),
      ref_number: ref.length > 8 ? ref : null,
      source: 'phonepe',
    });
  }
  return transactions;
}

/* ── GPay / Google Pay ──
   Google Takeout CSV:
   Date, Transaction ID, Description, Amount (INR), Status
*/
function parseGPayStatement(text) {
  const transactions = [];
  const lines = text.split('\n').filter(l => l.trim());

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map(c => c.replace(/^"|"$/g,'').trim()) || line.split(',').map(c=>c.trim());
    if (cols.length < 3) continue;

    const date   = normalizeDate(cols[0]);
    if (!date) continue;

    const ref    = cols[1] || '';
    const desc   = cols[2] || '';
    const amtRaw = cols[3] || cols[cols.length-2] || '0';
    const status = (cols[cols.length-1]||'').toLowerCase();

    if (status.includes('fail') || status.includes('decline')) continue;

    const rawAmt = amtRaw.replace(/rs\.?/gi,'').replace(/[₹,\s]/g,'');
    const isNeg  = rawAmt.startsWith('-') || amtRaw.includes('(');
    const amount = parseFloat(rawAmt.replace(/[^0-9.]/g,'')) || 0;
    if (amount === 0) continue;

    const type = isNeg ? 'expense' : 'income';
    const merchant = toTitleCase(desc.replace(/^(Paid to|Received from)\s*/i,'').split(/\s+via\s+/i)[0].substring(0,40));

    transactions.push({
      date,
      narration: desc.substring(0,120),
      merchant,
      description: desc.substring(0,120),
      amount, type,
      category: detectCategory(desc, merchant, isNeg),
      ref_number: ref || null,
      source: 'gpay',
    });
  }
  return transactions;
}

/* ── Paytm UPI PDF Parser ──────────────────────────────────────────────────
   Parses Paytm's "Passbook Payments History" PDF
   Format per transaction block:
     DATE\nTIME\nTransaction Details...\nTag: #Category\nAccount\nAmount
───────────────────────────────────────────────────────────────────────── */

// Map Paytm tags → Tracksy categories
const PAYTM_TAG_MAP = {
  'food':              'Food & Dining',
  'groceries':         'Food & Dining',
  'travel':            'Transport',
  'bill payments':     'Bills & Utilities',
  'money transfer':    'Shopping',       // will be treated as transfer
  'money received':    'Other Income',
  'shopping':          'Shopping',
  'fuel':              'Transport',
  'education':         'Education',
  'entertainment':     'Entertainment',
  'health':            'Health',
  'investment':        'Investment',
  'services':          'Bills & Utilities',
  'miscellaneous':     'Shopping',
  'credit card payment': 'Bills & Utilities',
  'self transfer':     null,             // skip self transfers
};

function parsePaytmPDF(text) {
  const transactions = [];

  // Split into lines, clean up
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Months map for date parsing
  const MONTH_MAP = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
                      Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };

  const YEAR = new Date().getFullYear(); // current year (statements are always current year)

  let i = 0;
  while (i < lines.length) {
    // Look for a date line like "01 Jun" or "31 May"
    const dateLine = lines[i].match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i);
    if (!dateLine) { i++; continue; }

    const day   = dateLine[1].padStart(2,'0');
    const month = MONTH_MAP[dateLine[2].charAt(0).toUpperCase() + dateLine[2].slice(1).toLowerCase()];
    const date  = `${YEAR}-${month}-${day}`;

    i++;
    // Next line should be time like "7:45 PM"
    if (i >= lines.length || !/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(lines[i])) continue;
    i++; // skip time line

    // Collect transaction detail lines until we hit "Tag:" or Account line or next date
    const detailLines = [];
    let tag = '';
    let amountRaw = '';
    let account = '';

    while (i < lines.length) {
      const l = lines[i];

      // Stop at next date block
      if (/^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i.test(l)) break;

      // Tag line: "# Food" or "#✈ Travel" or "# Bill Payments"
      if (l.startsWith('#') || l.startsWith('Tag:')) {
        const tagMatch = l.replace(/^Tag:/,'').replace(/^#\s*/,'').replace(/^[✈🏧💰]*\s*/,'').trim();
        if (tagMatch && !tagMatch.includes('Tag:')) tag = tagMatch;
        i++; continue;
      }

      // Amount line: "- Rs.340.50" or "+ Rs.1,000" or "Rs.7,000" (self transfer)
      if (/^[+\-]?\s*Rs\.\s*[\d,]+(\.\d+)?$/i.test(l)) {
        amountRaw = l; i++; continue;
      }

      // Account line: "HDFC Bank - 90" or "HDFC Bank Rupay Credit Card - 50"
      if (/HDFC|ICICI|Yes Bank|Other UPI|Gold Coin/i.test(l) && !/UPI ID/i.test(l)) {
        account = l; i++; continue;
      }

      // Note line: skip
      if (l.startsWith('Note:') || l === 'Note:') { i++; continue; }

      // Skip disclaimer lines
      if (/^This payment is not included/i.test(l)) { i++; continue; }

      detailLines.push(l);
      i++;
    }

    if (!amountRaw || !detailLines.length) continue;

    // Parse amount
    const isDebit  = amountRaw.trim().startsWith('-');
    const isCredit = amountRaw.trim().startsWith('+');
    const isSelf   = !isDebit && !isCredit; // self transfer — skip
    if (isSelf) continue;

    const amount = parseFloat(amountRaw.replace(/rs\.?/gi,'').replace(/[^0-9.]/g,''));
    if (!amount || amount === 0) continue;

    // Map tag to category
    const tagLower = tag.toLowerCase().replace(/^[^a-z]*/,'').trim();
    // Skip self transfers tagged as "Self Transfer"
    if (tagLower === 'self transfer') continue;

    const type = isCredit ? 'income' : 'expense';
    const category = PAYTM_TAG_MAP[tagLower] ||
      detectCategory(detailLines.join(' '), '', type === 'expense');

    // Extract merchant name from first detail line
    // "Paid to MERCHANT NAME" or "Money sent to NAME" or "Money received from NAME"
    const desc = detailLines[0] || '';
    let merchant = desc
      .replace(/^Paid to\s+/i,'')
      .replace(/^Money sent to\s+/i,'')
      .replace(/^Money received from\s+/i, '')
      .replace(/^Recharge of\s+/i, '')
      .replace(/^Automatic payment for\s+/i, '')
      .replace(/^Bill Payment of\s+/i, '')
      .trim();
    merchant = toTitleCase(merchant.substring(0, 50));

    // Extract UPI Ref No
    const refLine = detailLines.find(l => /UPI Ref No/i.test(l));
    const refMatch = refLine?.match(/UPI Ref No[:\s]+(\d+)/i);
    const upiRef   = refMatch?.[1] || null;

    // Extract UPI ID
    const upiLine  = detailLines.find(l => /UPI ID/i.test(l));
    const upiId    = upiLine?.replace(/^UPI ID:\s*/i,'').trim() || '';

    transactions.push({
      date,
      narration:   desc.substring(0,120),
      merchant,
      description: merchant,
      amount,
      type,
      category,
      ref_number:  upiRef,
      upi_id:      upiId,
      account,
      paytm_tag:   tag,
      source:      'paytm_pdf',
    });
  }

  return transactions;
}

/* ══════════════════════════════════════════════════════════════════════════
   Paytm Excel (XLSX/XLS) Parser
   Sheet: "Passbook"
   Columns: Date (DD/MM/YYYY) | Time | Transaction Details | ... | Amount | UPI Ref No. | ... | Tags
   Amount: negative string = debit/expense, positive = credit/income, commas as thousands sep
══════════════════════════════════════════════════════════════════════════ */
function parsePaytmExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });

  // Find Passbook sheet (case-insensitive)
  const sheetName = wb.SheetNames.find(n => /passbook/i.test(n)) || wb.SheetNames[0];
  const ws        = wb.Sheets[sheetName];
  const rows      = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (!rows.length) return [];

  // Find header row (contains "Date" and "Amount")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i].map(c => String(c).trim().toLowerCase());
    if (r.includes('date') && r.includes('amount')) { headerIdx = i; break; }
  }
  if (headerIdx === -1) return [];

  const headers = rows[headerIdx].map(c => String(c).trim());

  // Column indexes
  const col = (name) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
  const colDate    = col('date');
  const colDesc    = col('transaction details');
  const colAmount  = col('amount');
  const colRef     = col('upi ref');
  const colTags    = col('tags');
  const colComment = col('comment');
  const colRemark  = col('remarks');

  const transactions = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => !c)) continue; // skip empty rows

    const dateRaw = String(row[colDate] || '').trim();
    const desc    = String(row[colDesc]    || '').trim();
    const amtRaw  = String(row[colAmount]  || '').trim();
    const ref     = String(row[colRef]     || '').trim();
    const tags    = String(row[colTags]    || '').trim();
    const comment = String(row[colComment] || row[colRemark] || '').trim();

    if (!dateRaw || !amtRaw || amtRaw === '' || amtRaw === '0') continue;

    // Skip self transfers
    if (/self transfer/i.test(tags) || /self transfer/i.test(desc)) continue;

    // Parse date DD/MM/YYYY → YYYY-MM-DD
    const dateParts = dateRaw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (!dateParts) continue;
    const date = `${dateParts[3]}-${dateParts[2].padStart(2,'0')}-${dateParts[1].padStart(2,'0')}`;

    // Parse amount — remove commas, convert to number
    const amtNum = parseFloat(amtRaw.replace(/,/g, ''));
    if (isNaN(amtNum) || amtNum === 0) continue;

    const isDebit = amtNum < 0;
    const amount  = Math.abs(amtNum);
    const type    = isDebit ? 'expense' : 'income';

    // Extract merchant from description
    let merchant = desc
      .replace(/^Paid to\s+/i, '')
      .replace(/^Money sent to\s+/i, '')
      .replace(/^Money received from\s+/i, '')
      .replace(/^Recharge of\s+/i, 'Recharge ')
      .replace(/^Automatic payment for\s+/i, '')
      .replace(/^Bill Payment of\s+/i, '')
      .trim();
    merchant = toTitleCase(merchant.substring(0, 50));

    // Map Paytm tag → category
    const tagClean  = tags.replace(/^#\s*/,'').replace(/^[✈🏧💰✈️]*\s*/,'').trim().toLowerCase();
    const category  = PAYTM_TAG_MAP[tagClean] || detectCategory(desc + ' ' + comment, merchant, isDebit);

    transactions.push({
      date,
      narration:   desc.substring(0, 120),
      merchant,
      description: comment || merchant,
      amount,
      type,
      category,
      ref_number:  ref || null,
      paytm_tag:   tags,
      source:      'paytm_excel',
    });
  }

  return transactions;
}

/* ── Auto-detect format and parse ── */
function autoDetectAndParse(content, filename, source) {
  const lower = (filename||'').toLowerCase();
  const first500 = content.substring(0, 500).toLowerCase();

  if (source === 'paytm' || lower.includes('paytm') || first500.includes('wallet balance') || first500.includes('passbook')) {
    return { parsed: parsePaytmStatement(content), source: 'paytm' };
  }
  if (source === 'phonepe' || lower.includes('phonepe') || lower.includes('phone_pe') || first500.includes('phonepe')) {
    return { parsed: parsePhonePeStatement(content), source: 'phonepe' };
  }
  if (source === 'gpay' || lower.includes('gpay') || lower.includes('google') || first500.includes('transaction id') && first500.includes('status')) {
    return { parsed: parseGPayStatement(content), source: 'gpay' };
  }
  if (lower.includes('hdfc') || first500.includes('narration') || first500.includes('chq')) {
    return { parsed: parseHDFCStatement(content), source: 'hdfc' };
  }

  // Try all parsers and pick the one with most results
  const hdfc    = parseHDFCStatement(content);
  const paytm   = parsePaytmStatement(content);
  const phonepe = parsePhonePeStatement(content);
  const gpay    = parseGPayStatement(content);

  const best = [
    { src:'hdfc',    txs: hdfc    },
    { src:'paytm',   txs: paytm   },
    { src:'phonepe', txs: phonepe },
    { src:'gpay',    txs: gpay    },
  ].sort((a,b) => b.txs.length - a.txs.length)[0];

  return { parsed: best.txs, source: best.src };
}

/* ══════════════════════════════════════════════════════════════════
   API HANDLERS
══════════════════════════════════════════════════════════════════ */

/* ── HDFC Bank statement PDF ──
   Rows are concatenated as: <txnDate><narration><ref><valueDate><amount><closingBalance>.
   Direction (debit/credit) is derived from the running closing balance, which
   makes it self-validating regardless of which column the amount sits in. */
function parseHDFCPDF(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Opening balance from the statement summary
  let opening = null;
  const si = lines.findIndex(l => /Opening Balance/i.test(l) && /Closing Bal/i.test(l));
  if (si >= 0 && lines[si + 1]) {
    const m = lines[si + 1].match(/(\d{1,3}(?:,\d{3})*\.\d{2})/);
    if (m) opening = parseFloat(m[1].replace(/,/g, ''));
  }

  const tailRe  = /(\d{2}\/\d{2}\/\d{2})(\d{1,3}(?:,\d{3})*\.\d{2})(\d{1,3}(?:,\d{3})*\.\d{2})/;
  const startRe = /^(\d{2})\/(\d{2})\/(\d{2})/;
  const out = [];
  let prevClosing = opening;
  let i = 0;

  while (i < lines.length) {
    if (!startRe.test(lines[i])) { i++; continue; }
    const block = [lines[i]]; let j = i + 1;
    while (j < lines.length && !startRe.test(lines[j])) { block.push(lines[j]); j++; }
    i = j;

    let tail = null;
    for (const bl of block) { const m = bl.match(tailRe); if (m) { tail = m; break; } }
    if (!tail) continue;

    const dm = block[0].match(startRe);
    const date    = `20${dm[3]}-${dm[2]}-${dm[1]}`;
    const amount  = parseFloat(tail[2].replace(/,/g, ''));
    const closing = parseFloat(tail[3].replace(/,/g, ''));
    if (!amount) continue;

    let type = 'expense';
    if (prevClosing != null) {
      if (Math.abs(prevClosing - amount - closing) < 1) type = 'expense';
      else if (Math.abs(prevClosing + amount - closing) < 1) type = 'income';
      else type = closing < prevClosing ? 'expense' : 'income';
    }
    prevClosing = closing;

    // Narration → merchant/payee name
    const narr = block.join(' ').replace(tailRe, ' ').replace(startRe, ' ').replace(/\s+/g, ' ').trim();
    const stripped = narr.replace(/^(UPI|IMPS|NEFT|RTGS|ACH[\s-]*[DC]?|POS|ATW|MMT|EMI|CMS|ME DC|CC)\s*-?\s*/i, '');
    const mm = stripped.match(/[A-Za-z][A-Za-z .&]{2,30}/);
    let merchant = mm ? mm[0].replace(/\s+/g, ' ').trim() : (narr.slice(0, 30) || 'Transaction');

    out.push({
      date, amount, type,
      category: detectCategory(narr, '', type === 'expense') || 'Uncategorized',
      merchant: toTitleCase(merchant),
      description: toTitleCase(merchant),
      ref: '', source: 'hdfc_pdf',
    });
  }
  return out;
}

/* ── Generic bank-statement PDF (best effort — HDFC/ICICI/SBI etc.) ──
   Handles rows with a date + amounts. For most Indian bank statements the row
   has Withdrawal / Deposit / Closing-balance amounts; we treat the amount right
   before the (largest, last) balance as the transaction amount. */
function parseGenericBankPDF(text) {
  const lines = text.split('\n').map(l => l.replace(/\s+/g,' ').trim()).filter(Boolean);
  const dateRe = /(\d{1,2}[\/\-.](?:\d{1,2}|[A-Za-z]{3})[\/\-.]\d{2,4})/;
  const MON = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
  const out = [];
  for (const l of lines) {
    const dm = l.match(dateRe);
    if (!dm) continue;
    const amts = (l.match(/\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+\.\d{2}/g) || [])
      .map(a => parseFloat(a.replace(/,/g,''))).filter(n => n > 0);
    if (!amts.length) continue;
    const amount = amts.length >= 2 ? amts[amts.length - 2] : amts[0];  // before closing balance
    if (!amount) continue;
    // date → YYYY-MM-DD
    const parts = dm[1].split(/[\/\-.]/);
    let [d, mo, y] = parts;
    mo = /^[A-Za-z]+$/.test(mo) ? (MON[mo.toLowerCase().slice(0,3)] || '01') : mo.padStart(2,'0');
    y = y.length === 2 ? '20' + y : y;
    const date = `${y}-${mo}-${d.padStart(2,'0')}`;
    const desc = l.replace(dateRe,'').replace(/\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+\.\d{2}/g,'').replace(/\s+/g,' ').trim().slice(0,60) || 'Transaction';
    const isCredit = /\b(cr|credit|deposit|received|neft cr|imps cr)\b/i.test(l) && !/\b(dr|debit|withdrawal)\b/i.test(l);
    out.push({ date, amount, type: isCredit ? 'income' : 'expense', category: detectCategory(desc,'',!isCredit) || 'Uncategorized', merchant: toTitleCase(desc), description: desc, ref:'', source:'bank_pdf' });
  }
  return out;
}

/* ── POST /api/import/preview ── */
const previewStatement = async (req, res) => {
  try {
    // req.file  = multer file upload (PDF / any binary)
    // req.body  = JSON fields (content, filename, source for CSV)
    const file     = req.file;                              // from multer
    const { content, filename: bodyFilename, source } = req.body;
    const filename = file?.originalname || bodyFilename || '';

    if (!file && !content) {
      return res.status(400).json({ success:false, message:'No file content provided' });
    }

    let parsed, detectedSource;

    const lname  = filename.toLowerCase();
    const isExcel = file && (lname.endsWith('.xlsx') || lname.endsWith('.xls') ||
                    file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    file.mimetype === 'application/vnd.ms-excel');
    const isPDF  = !isExcel && file &&
                   (file.mimetype === 'application/pdf' || lname.endsWith('.pdf'));

    if (isExcel) {
      // ── Excel (best quality — has clean amounts + tags) ──
      parsed = parsePaytmExcel(file.buffer);
      detectedSource = 'paytm_excel';
      if (!parsed.length) return res.status(400).json({ success:false, message:'No transactions found in Excel. Make sure the file has a Passbook sheet.' });
    } else if (isPDF && file) {
      // ── PDF (may be password protected) ──
      let text;
      try {
        text = await extractPdfText(file.buffer, req.body.password);
      } catch (e) {
        if (e.needsPassword) {
          return res.json({ success:false, needsPassword:true, incorrect: !!e.incorrect, message: e.message });
        }
        throw e;
      }
      // HDFC statements have a distinctive header; parse those precisely first
      const isHDFC = /Withdrawal Amt\.?Deposit Amt\.?Closing Balance/i.test(text) || /HDFC BANK/i.test(text);
      if (isHDFC) {
        parsed = parseHDFCPDF(text);
        detectedSource = 'hdfc_pdf';
      }
      // Otherwise try Paytm UPI, generic auto-detect, then generic bank PDF
      if (!parsed || !parsed.length) { parsed = parsePaytmPDF(text); detectedSource = 'paytm_pdf'; }
      if (!parsed.length) {
        const r = autoDetectAndParse(text, filename, source);
        parsed = r.parsed; detectedSource = r.source;
      }
      if (!parsed.length) {
        parsed = parseGenericBankPDF(text);
        detectedSource = 'bank_pdf';
      }
      if (!parsed.length) {
        return res.status(400).json({
          success:false,
          message:'Could not find transactions in this PDF. Please share the sample text below so we can add support for this statement format.',
          sample: (text || '').replace(/\s+/g,' ').trim().slice(0, 1200),
        });
      }
    } else {
      // ── CSV / TXT ──
      const textContent = file ? file.buffer.toString('utf-8') : content;
      const result = autoDetectAndParse(textContent, filename, source);
      parsed = result.parsed;
      detectedSource = result.source;
      if (!parsed.length) return res.status(400).json({ success:false, message:'No transactions found. Make sure it is a valid CSV statement.' });
    }

    const catsRes = await query(
      'SELECT id, name FROM categories WHERE user_id=$1 OR is_default=true',
      [req.user.userId]
    );
    const categories = catsRes.rows;

    const mapped = parsed.map(tx => {
      const cat = categories.find(c => c.name.toLowerCase() === tx.category.toLowerCase())
               || categories.find(c => tx.category.toLowerCase().includes(c.name.toLowerCase()))
               || null;
      return { ...tx, category_id: cat?.id||null, category_name: cat?.name||tx.category };
    });

    res.json({
      success: true,
      data: {
        transactions: mapped,
        source: detectedSource,
        total:         mapped.length,
        total_credit:  mapped.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),
        total_debit:   mapped.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0),
        filename,
      }
    });
  } catch (err) {
    console.error('Import preview error:', err);
    res.status(500).json({ success:false, message: err.message });
  }
};

/* ── POST /api/import/reconcile ──
   Compares uploaded transactions with existing ones
   Returns status: 'matched' | 'new' | 'duplicate'
*/
const reconcileStatement = async (req, res) => {
  try {
    const { transactions } = req.body;
    if (!transactions?.length) return res.status(400).json({ success:false, message:'No transactions provided' });

    const userId = req.user.userId;

    // Fetch last 12 months of existing transactions
    const existing = await query(
      `SELECT id, type, amount::float, description, payment_name, transaction_date::date::text
       FROM transactions
       WHERE user_id=$1 AND transaction_date >= NOW() - INTERVAL '12 months'
       ORDER BY transaction_date DESC`,
      [userId]
    );

    const results = transactions.map(tx => {
      // Check for exact match: same date + same amount + same type
      const exactMatch = existing.rows.find(ex =>
        ex.transaction_date === tx.date &&
        Math.abs(ex.amount - tx.amount) < 0.5 &&
        ex.type === tx.type
      );

      if (exactMatch) {
        return { ...tx, status: 'matched', matched_id: exactMatch.id, matched_desc: exactMatch.description };
      }

      // Check for probable duplicate: same amount + type within 2 days
      const txDate = new Date(tx.date);
      const nearMatch = existing.rows.find(ex => {
        const exDate = new Date(ex.transaction_date);
        const daysDiff = Math.abs((txDate - exDate) / 86400000);
        return daysDiff <= 2 && Math.abs(ex.amount - tx.amount) < 0.5 && ex.type === tx.type;
      });

      if (nearMatch) {
        return { ...tx, status: 'possible_duplicate', matched_id: nearMatch.id, matched_desc: nearMatch.description };
      }

      return { ...tx, status: 'new' };
    });

    const summary = {
      total:              results.length,
      matched:            results.filter(r=>r.status==='matched').length,
      possible_duplicate: results.filter(r=>r.status==='possible_duplicate').length,
      new:                results.filter(r=>r.status==='new').length,
    };

    res.json({ success:true, data: { transactions: results, summary } });
  } catch (err) {
    console.error('Reconcile error:', err);
    res.status(500).json({ success:false, message: err.message });
  }
};

/* ── POST /api/import/confirm ── */
const confirmImport = async (req, res) => {
  try {
    const { transactions, wallet_id } = req.body;
    if (!transactions?.length) return res.status(400).json({ success:false, message:'No transactions to import' });

    const userId = req.user.userId;
    let imported = 0, skipped = 0;

    // Track per-wallet balance delta so we can apply one UPDATE per wallet at the end
    const walletDelta = {}; // { wallet_id: delta }

    for (const tx of transactions) {
      if (tx.skip || tx.status === 'matched') { skipped++; continue; }

      if (tx.ref_number) {
        const exists = await query(
          'SELECT id FROM transactions WHERE user_id=$1 AND payment_name=$2',
          [userId, tx.ref_number]
        );
        if (exists.rows.length) { skipped++; continue; }
      }

      const wid = tx.wallet_id || wallet_id || null;

      await query(`
        INSERT INTO transactions
          (user_id, wallet_id, category_id, type, amount, description, payment_name, status, transaction_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',$8)
      `, [
        userId,
        wid,
        tx.category_id || null,
        tx.type,
        tx.amount,
        tx.description || tx.merchant,
        tx.ref_number || null,
        tx.date,
      ]);

      // Accumulate balance change for the wallet
      if (wid) {
        const sign = tx.type === 'income' ? 1 : -1;
        walletDelta[wid] = (walletDelta[wid] || 0) + sign * parseFloat(tx.amount);
      }

      imported++;
    }

    // Apply wallet balance updates in one pass
    for (const [wid, delta] of Object.entries(walletDelta)) {
      if (delta !== 0) {
        await query(
          'UPDATE wallets SET balance = balance + $1 WHERE id=$2 AND user_id=$3',
          [delta, wid, userId]
        );
      }
    }

    res.json({ success:true, data: { imported, skipped, total: transactions.length, wallet_updated: Object.keys(walletDelta).length } });
  } catch (err) {
    console.error('Import confirm error:', err);
    res.status(500).json({ success:false, message: err.message });
  }
};

module.exports = { previewStatement, reconcileStatement, confirmImport };
