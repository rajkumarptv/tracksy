const { query } = require('../db');

// ─── Smart narration cleaner ────────────────────────────────────────────────
function parseNarration(raw) {
  const n = raw.trim();

  // UPI: "UPI-MERCHANT NAME-upiid@bank-IFSC-refno-DESCRIPTION"
  if (n.startsWith('UPI-')) {
    const parts = n.slice(4).split('-');
    // merchant is first part (before any @ or digits-only part)
    let merchant = parts[0] || '';
    // strip leading "MR ", "MRS ", "MS " honorifics
    merchant = merchant.replace(/^(MR\.?\s+|MRS\.?\s+|MS\.?\s+)/i, '').trim();
    // grab optional description at the end (last part if it's words, not a ref number)
    const lastPart = parts[parts.length - 1] || '';
    const hasDesc = lastPart && !/^\d{6,}$/.test(lastPart) && !/^UPI$/.test(lastPart) &&
                    !/^SENT USING PAYTM/i.test(lastPart) && !/^NA$/i.test(lastPart) &&
                    !/^PAYMENT FROM PHONE/i.test(lastPart);
    const desc = hasDesc ? lastPart : '';
    return { merchant: toTitleCase(merchant), description: toTitleCase(desc) };
  }

  // ACH Debit (EMI/loan)
  if (/^ACH D[- ]/.test(n)) {
    const match = n.match(/ACH D[- ]\s*([A-Z0-9& ]+?)[-\s]/i);
    const merchant = match ? match[1].trim() : 'ACH Debit';
    return { merchant: toTitleCase(merchant), description: 'EMI / Loan Payment' };
  }

  // ACH Debit return
  if (/^ACH DEBIT RETURN/i.test(n)) {
    return { merchant: 'ACH Debit Return', description: 'Bank Charges' };
  }

  // IMPS
  if (/^IMPS-/.test(n)) {
    const parts = n.split('-');
    const merchant = parts[2] || 'IMPS Transfer';
    return { merchant: toTitleCase(merchant.trim()), description: 'IMPS Transfer' };
  }

  // NEFT
  if (/^NEFT (CR|DR)-/.test(n)) {
    const parts = n.split('-');
    const merchant = parts[2] || 'NEFT Transfer';
    return { merchant: toTitleCase(merchant.trim()), description: 'NEFT Transfer' };
  }

  // IB BILLPAY (credit card bill)
  if (/^IB BILLPAY/i.test(n)) {
    return { merchant: 'Credit Card Bill', description: 'Bill Payment' };
  }

  return { merchant: toTitleCase(n.substring(0, 40)), description: '' };
}

function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).trim();
}

// ─── Smart category detector ────────────────────────────────────────────────
function detectCategory(narration, merchant, isDebit) {
  const text = (narration + ' ' + merchant).toLowerCase();

  if (!isDebit) {
    if (/salary|payroll|stipend/i.test(text)) return 'Salary';
    if (/gim info|freelance|invoice|payment received/i.test(text)) return 'Freelance';
    if (/neft|imps|transfer received|received/i.test(text)) return 'Transfer';
    if (/refund|return|cashback/i.test(text)) return 'Refund';
    if (/interest|dividend/i.test(text)) return 'Investment';
    return 'Income';
  }

  // Loans / EMI
  if (/ach d|emi|loan|kisestu|l&t finance|idfc|moneyview|smfg|bajaj|hdfc loan|piramal|tata capital|fullerton|shriram/i.test(text)) return 'Loan EMI';

  // Credit Card
  if (/credit card|creditcard|cred\.club|cred club|billpay|rbl bank|amex|sbi card/i.test(text)) return 'Credit Card';

  // Fuel / Transport
  if (/fuel|petrol|balaji fuels|om service station|indian oil|shell|hp petrol|bpcl|hpcl|cng/i.test(text)) return 'Fuel';
  if (/redbus|ola|uber|rapido|metro|railway|irctc|bus|train|flight|indigo|spicejet|makemytrip|goibibo|taxi/i.test(text)) return 'Transport';

  // Food & Dining
  if (/bakery|restaurant|hotel|cafe|coffee|tea stall|foods|dinetech|canteen|swiggy|zomato|domino|pizza|biryani|mess|tiffin|snacks|juice|milk|dairy/i.test(text)) return 'Food & Dining';

  // Groceries
  if (/super market|supermarket|grocery|ranjitham|sabarivel|vignesh agencies|kirana|provision|store/i.test(text)) return 'Groceries';

  // Utilities / Bills
  if (/airtel|jio|vi |vodafone|bsnl|internet|broadband|electricity|eb |tneb|bescom|water bill|gas bill|lpg|cylinder/i.test(text)) return 'Bills & Utilities';

  // Shopping / Online
  if (/flipkart|amazon|meesho|myntra|ajio|nykaa|reliance|d-mart|big bazaar|shoppers/i.test(text)) return 'Shopping';

  // Gold / Investment
  if (/caratlane|tanishq|gold|sovereign|mutual fund|sip|zerodha|groww|coin|sensex|nifty/i.test(text)) return 'Investment';

  // Insurance
  if (/insurance|hdfc life|lic|sbi life|bajaj allianz|star health|mediclaim|premium/i.test(text)) return 'Insurance';

  // Medical
  if (/hospital|clinic|pharmacy|medical|doctor|eye care|dental|health|apollo|fortis/i.test(text)) return 'Medical';

  // Education
  if (/school|college|university|tuition|fees|course|coaching/i.test(text)) return 'Education';

  // Bank charges
  if (/charges|penalty|fine|late fee|processing fee|gst|tax/i.test(text)) return 'Bank Charges';

  // Transfer / Personal
  if (/transfer|neft|imps/i.test(text)) return 'Transfer';

  return 'Others';
}

// ─── Parse HDFC statement text ──────────────────────────────────────────────
function parseHDFCStatement(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const transactions = [];

  for (const line of lines) {
    // skip header line
    if (/Date\s*,Narration/i.test(line)) continue;

    const cols = line.split(',');
    if (cols.length < 6) continue;

    const dateRaw    = (cols[0] || '').trim();
    const narration  = (cols[1] || '').trim();
    const debitRaw   = (cols[3] || '').trim().replace(/\s/g, '');
    const creditRaw  = (cols[4] || '').trim().replace(/\s/g, '');
    const refNumber  = (cols[5] || '').trim();
    const closingBal = parseFloat((cols[6] || '0').trim().replace(/\s/g, '')) || 0;

    if (!dateRaw || !narration) continue;

    // Parse date: DD/MM/YY → YYYY-MM-DD
    const dateParts = dateRaw.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!dateParts) continue;
    const day   = dateParts[1].padStart(2, '0');
    const month = dateParts[2].padStart(2, '0');
    const yr    = dateParts[3].length === 2 ? '20' + dateParts[3] : dateParts[3];
    const date  = `${yr}-${month}-${day}`;

    const debit  = parseFloat(debitRaw)  || 0;
    const credit = parseFloat(creditRaw) || 0;

    // skip zero-amount rows
    if (debit === 0 && credit === 0) continue;

    const isDebit    = debit > 0;
    const amount     = isDebit ? debit : credit;
    const type       = isDebit ? 'expense' : 'income';

    const { merchant, description } = parseNarration(narration);
    const category = detectCategory(narration, merchant, isDebit);

    transactions.push({
      date,
      narration: narration.substring(0, 120),
      merchant,
      description: description || merchant,
      amount,
      type,
      category,
      ref_number: refNumber,
      closing_balance: closingBal,
    });
  }

  return transactions;
}

// ─── POST /api/import/preview ───────────────────────────────────────────────
const previewStatement = async (req, res) => {
  try {
    const { content, filename } = req.body;
    if (!content) return res.status(400).json({ success: false, message: 'No file content provided' });

    const transactions = parseHDFCStatement(content);
    if (!transactions.length) return res.status(400).json({ success: false, message: 'No transactions found in file' });

    // Get user's categories for mapping
    const catsRes = await query(
      'SELECT id, name FROM categories WHERE user_id=$1 OR is_default=true',
      [req.user.userId]
    );
    const categories = catsRes.rows;

    // Map detected category names to actual category IDs
    const mapped = transactions.map(tx => {
      const cat = categories.find(c => c.name.toLowerCase() === tx.category.toLowerCase())
                || categories.find(c => tx.category.toLowerCase().includes(c.name.toLowerCase()))
                || null;
      return { ...tx, category_id: cat?.id || null, category_name: cat?.name || tx.category };
    });

    res.json({
      success: true,
      data: {
        transactions: mapped,
        total: mapped.length,
        total_credit: mapped.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),
        total_debit:  mapped.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0),
        filename,
      }
    });
  } catch (err) {
    console.error('Import preview error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/import/confirm ───────────────────────────────────────────────
const confirmImport = async (req, res) => {
  try {
    const { transactions, wallet_id } = req.body;
    if (!transactions?.length) return res.status(400).json({ success: false, message: 'No transactions to import' });

    const userId = req.user.userId;
    let imported = 0;
    let skipped  = 0;

    for (const tx of transactions) {
      if (tx.skip) { skipped++; continue; }

      // Check duplicate by ref_number
      if (tx.ref_number) {
        const exists = await query(
          'SELECT id FROM transactions WHERE user_id=$1 AND payment_name=$2',
          [userId, tx.ref_number]
        );
        if (exists.rows.length) { skipped++; continue; }
      }

      await query(`
        INSERT INTO transactions
          (user_id, wallet_id, category_id, type, amount, description, payment_name, status, transaction_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',$8)
      `, [
        userId,
        wallet_id || null,
        tx.category_id || null,
        tx.type,
        tx.amount,
        tx.description || tx.merchant,
        tx.ref_number || null,
        tx.date,
      ]);
      imported++;
    }

    res.json({ success: true, data: { imported, skipped, total: transactions.length } });
  } catch (err) {
    console.error('Import confirm error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { previewStatement, confirmImport };
