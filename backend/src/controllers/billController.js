const { query } = require('../db');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');

const { putObject, getObject, deleteObject } = require('../lib/storage');

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

    res.json({ success: true, bill: rows[0] });
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
    res.json({ success: true, bills: rows });
  } catch (err) {
    console.error('getBills:', err);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
};

/* ── GET /api/bills/:billId/file ──────────────────────────────── */
const serveFile = async (req, res) => {
  try {
    // Accept token from query param (for direct img/anchor access) or from auth middleware
    let userId = req.user?.userId;
    if (!userId && req.query.t) {
      try {
        const decoded = jwt.verify(req.query.t, process.env.JWT_SECRET);
        userId = decoded.userId;
      } catch { return res.status(401).json({ error: 'Invalid token' }); }
    }
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { billId } = req.params;

    const { rows } = await query(
      'SELECT * FROM transaction_bills WHERE id=$1 AND user_id=$2',
      [billId, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    const bill = rows[0];
    const buf  = await getObject(bill.file_name);
    if (!buf) return res.status(404).json({ error: 'File missing' });

    res.setHeader('Content-Type', bill.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${bill.original_name}"`);
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
