const { query } = require('../db');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');

const { putObject, getObject, deleteObject } = require('../lib/storage');
const { BILL_MIME_ALLOW } = require('../utils/security');

// Links to a file (<img src>, <a href>) can't carry an Authorization header, so they carry a token in the
// URL. That token is single-purpose and short-lived: it opens exactly this bill for a day and cannot
// be used as a login, so a leaked link (history, logs, a screenshot) exposes one receipt, not the account.
const fileToken = (billId, userId) => jwt.sign({ purpose: 'bill', bill: billId, userId }, process.env.JWT_SECRET, { expiresIn: '24h' });
const withToken = (b, userId) => ({ ...b, file_token: fileToken(b.id, userId) });

/* ── POST /api/transactions/:id/bills ─────────────────────────── */
const uploadBill = async (req, res) => {
  try {
    const userId = req.user.userId;
    const txId   = req.params.id;

    // verify transaction belongs to user
    const txCheck = await query(
      'SELECT id FROM transactions WHERE id=$1 AND user_id=$2',
      [txId, userId]
    );
    if (!txCheck.rows.length) return res.status(404).json({ error: 'Transaction not found' });

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!BILL_MIME_ALLOW.includes(String(req.file.mimetype).toLowerCase())) {
      return res.status(415).json({ error: 'Only images and PDF files can be attached' });
    }

    const { originalname, mimetype, size, buffer } = req.file;
    const ext      = path.extname(originalname).toLowerCase() || '.bin';
    const fileId   = randomUUID();
    const fileName = `${fileId}${ext}`;
    await putObject(fileName, buffer, mimetype);

    const { rows } = await query(
      `INSERT INTO transaction_bills
         (id, transaction_id, user_id, original_name, file_name, mime_type, file_size)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [fileId, txId, userId, originalname, fileName, mimetype, size]
    );

    res.json({ success: true, bill: withToken(rows[0], userId) });
  } catch (err) {
    console.error('uploadBill:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
};

/* ── GET /api/transactions/:id/bills ──────────────────────────── */
const getBills = async (req, res) => {
  try {
    const userId = req.user.userId;
    const txId   = req.params.id;

    const { rows } = await query(
      `SELECT id, original_name, file_name, mime_type, file_size, created_at
       FROM transaction_bills
       WHERE transaction_id=$1 AND user_id=$2
       ORDER BY created_at ASC`,
      [txId, userId]
    );
    res.json({ success: true, bills: rows.map(b => withToken(b, userId)) });
  } catch (err) {
    console.error('getBills:', err);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
};

/* ── GET /api/bills/:billId/file ──────────────────────────────── */
const serveFile = async (req, res) => {
  try {
    // Either the normal Authorization header, or a short-lived link token for exactly this bill
    const { billId } = req.params;
    let userId;
    const header = req.headers.authorization;
    try {
      if (header?.startsWith('Bearer ')) {
        userId = jwt.verify(header.slice(7), process.env.JWT_SECRET).userId;
      } else if (req.query.t) {
        const d = jwt.verify(String(req.query.t), process.env.JWT_SECRET);
        if (d.purpose !== 'bill' || d.bill !== billId) return res.status(401).json({ error: 'Invalid link' });
        userId = d.userId;
      }
    } catch { return res.status(401).json({ error: 'Invalid or expired link' }); }
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows } = await query(
      'SELECT * FROM transaction_bills WHERE id=$1 AND user_id=$2',
      [billId, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    const bill = rows[0];
    const buf  = await getObject(bill.file_name);
    if (!buf) return res.status(404).json({ error: 'File missing' });

    // Never let the browser guess a type or run an uploaded file as a page
    const safeName = String(bill.original_name || 'bill').replace(/[^\w.\- ]/g, '_').slice(0, 100);
    const inlineOk = BILL_MIME_ALLOW.includes(String(bill.mime_type).toLowerCase());
    res.setHeader('Content-Type', inlineOk ? bill.mime_type : 'application/octet-stream');
    res.setHeader('Content-Disposition', `${inlineOk ? 'inline' : 'attachment'}; filename="${safeName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
    res.send(buf);
  } catch (err) {
    console.error('serveFile:', err);
    res.status(500).json({ error: 'Failed to serve file' });
  }
};

/* ── DELETE /api/bills/:billId ────────────────────────────────── */
const deleteBill = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { billId } = req.params;

    const { rows } = await query(
      'DELETE FROM transaction_bills WHERE id=$1 AND user_id=$2 RETURNING file_name',
      [billId, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    await deleteObject(rows[0].file_name);

    res.json({ success: true });
  } catch (err) {
    console.error('deleteBill:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
};

module.exports = { uploadBill, getBills, serveFile, deleteBill };
