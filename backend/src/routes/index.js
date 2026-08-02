const express = require('express');
const multer  = require('multer');
const router = express.Router();
const auth = require('../middleware/auth');
const authCtrl = require('../controllers/authController');
const dashCtrl = require('../controllers/dashboardController');
const txCtrl = require('../controllers/transactionController');
const budgetCtrl = require('../controllers/budgetController');
const res0 = require('../controllers/resourceController');
const importCtrl = require('../controllers/importController');

// multer: store uploaded files in memory (max 20 MB)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const waCtrl = require('../controllers/whatsappController');
const oauth = require('../middleware/oauth');
const adminCtrl = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');
const recurringCtrl = require('../controllers/recurringController');

// Auth — email/password
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.get('/auth/me', auth, authCtrl.getMe);
router.put('/auth/profile', auth, authCtrl.updateProfile);
router.post('/auth/change-password', auth, authCtrl.changePassword);
router.post('/auth/forgot-password', authCtrl.forgotPassword);
router.post('/auth/reset-password', authCtrl.resetPassword);
router.get('/auth/notification-preferences', auth, authCtrl.getNotificationPrefs);
router.put('/auth/notification-preferences', auth, authCtrl.updateNotificationPrefs);

// Auth — Google OAuth
router.get('/auth/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_not_configured`);
  oauth.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});
router.get('/auth/google/callback', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_not_configured`);
  oauth.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth` })(req, res, next);
}, oauth.issueTokenRedirect);

// Auth — Facebook OAuth
router.get('/auth/facebook', (req, res, next) => {
  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET)
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=facebook_not_configured`);
  oauth.authenticate('facebook', { scope: ['email'], session: false })(req, res, next);
});
router.get('/auth/facebook/callback', (req, res, next) => {
  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET)
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=facebook_not_configured`);
  oauth.authenticate('facebook', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth` })(req, res, next);
}, oauth.issueTokenRedirect);

// Dashboard
router.get('/dashboard/summary', auth, dashCtrl.getSummary);
router.get('/dashboard/money-flow', auth, dashCtrl.getMoneyFlow);
router.get('/dashboard/recent-transactions', auth, dashCtrl.getRecentTransactions);
router.get('/dashboard/category-breakdown', auth, dashCtrl.getCategoryBreakdown);
router.get('/dashboard/analytics-stats', auth, dashCtrl.getAnalyticsStats);

// Transactions
router.get('/transactions', auth, txCtrl.getAll);
router.get('/transactions/export/csv', auth, res0.exportCSV);
router.get('/transactions/:id', auth, txCtrl.getById);
router.post('/transactions', auth, txCtrl.create);
router.put('/transactions/:id', auth, txCtrl.update);
router.delete('/transactions/:id', auth, txCtrl.remove);

// Budgets
router.get('/budgets', auth, budgetCtrl.getAll);
router.post('/budgets', auth, budgetCtrl.create);
router.put('/budgets/:id', auth, budgetCtrl.update);
router.delete('/budgets/:id', auth, budgetCtrl.remove);

// Saving Goals
router.get('/goals', auth, res0.getAllGoals);
router.post('/goals', auth, res0.createGoal);
router.put('/goals/:id', auth, res0.updateGoal);
router.post('/goals/:id/add-funds', auth, res0.addFundsToGoal);
router.delete('/goals/:id', auth, res0.deleteGoal);

// Wallets
router.get('/wallets', auth, res0.getAllWallets);
router.post('/wallets', auth, res0.createWallet);
router.put('/wallets/:id', auth, res0.updateWallet);
router.delete('/wallets/:id', auth, res0.deleteWallet);
router.post('/wallets/:id/reconcile', auth, res0.reconcileWallet);
router.post('/wallets/:id/payment', auth, res0.payLiability);

// Net worth history
router.get('/net-worth/history', auth, res0.getNetWorthHistory);
router.post('/net-worth/snapshot', auth, res0.saveNetWorthSnapshot);

// Recurring transactions
router.get('/recurring', auth, recurringCtrl.getAll);
router.post('/recurring', auth, recurringCtrl.create);
router.put('/recurring/:id', auth, recurringCtrl.update);
router.delete('/recurring/:id', auth, recurringCtrl.remove);
router.post('/recurring/process', auth, recurringCtrl.process);

// Data management
router.get('/data/export', auth, res0.exportData);
router.post('/data/reset', auth, res0.resetData);

// Bank statement import + reconciliation
router.post('/import/preview',    auth, upload.single('file'), importCtrl.previewStatement);
router.post('/import/reconcile',  auth, importCtrl.reconcileStatement);
router.post('/import/confirm',    auth, importCtrl.confirmImport);

// Categories
router.get('/categories', auth, res0.getAllCategories);
router.post('/categories', auth, res0.createCategory);
router.put('/categories/:id', auth, res0.updateCategory);
router.delete('/categories/:id', auth, res0.deleteCategory);

// WhatsApp — savePhone is protected; webhook is public
router.put('/whatsapp/phone', auth, waCtrl.savePhone);

// WhatsApp via Meta Cloud API (screenshot OCR → transaction)
const waMeta = require('../controllers/whatsappMetaController');
router.get('/whatsapp/meta/webhook',  waMeta.verify);    // Meta verification handshake
router.post('/whatsapp/meta/webhook', waMeta.receive);   // Meta delivers messages here

// Receipt scan (PWA share-target / in-app upload → OCR → review)
const receiptCtrl = require('../controllers/receiptController');
router.post('/receipt/scan', auth, upload.single('file'), receiptCtrl.scan);

// Admin — requires valid JWT + is_admin flag
router.get('/admin/stats',                    auth, adminAuth, adminCtrl.getStats);
router.get('/admin/users',                    auth, adminAuth, adminCtrl.getUsers);
router.patch('/admin/users/:userId/premium',  auth, adminAuth, adminCtrl.togglePremium);

// Admin — read-only family oversight
router.get('/admin/families',                       auth, adminAuth, adminCtrl.listFamilies);

// Gmail auto-import
const gmailCtrl = require('../controllers/gmailController');
router.get('/gmail/connect',      gmailCtrl.connect);    // browser redirect (?token=)
router.get('/gmail/callback',     gmailCtrl.callback);   // Google redirect (?state=)
router.get('/gmail/status',       auth, gmailCtrl.status);
router.post('/gmail/sync',        auth, gmailCtrl.syncNow);
router.post('/gmail/toggle',      auth, gmailCtrl.toggleSync);
router.post('/gmail/disconnect',  auth, gmailCtrl.disconnect);

// Broker integrations (Dhan)
const brokerCtrl = require('../controllers/brokerController');
router.post('/broker/dhan/holdings', auth, brokerCtrl.getDhanHoldings);

// Family — consent-based: create (premium), join by code, leave, overview
const familyCtrl = require('../controllers/familyController');
router.get('/family/status',          auth, familyCtrl.getStatus);
router.post('/family/create',         auth, familyCtrl.createFamily);
router.post('/family/join',           auth, familyCtrl.joinFamily);
router.post('/family/leave',          auth, familyCtrl.leaveFamily);
router.post('/family/remove-member',  auth, familyCtrl.removeMember);
router.get('/family/overview',        auth, familyCtrl.getOverview);
router.get('/family/member/:id',      auth, familyCtrl.getMemberDetail);

// Bill attachments — upload per transaction, serve file, delete
const billCtrl = require('../controllers/billController');
const billUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
router.post('/transactions/:id/bills', auth, billUpload.single('file'), billCtrl.uploadBill);
router.get('/transactions/:id/bills',  auth, billCtrl.getBills);
router.get('/bills/:billId/file',      billCtrl.serveFile); // token via ?t= query param or Bearer header
router.delete('/bills/:billId',        auth, billCtrl.deleteBill);

/* ── Scheduled jobs ─────────────────────────────────────────────────────
   Serverless has no always-on process, so node-cron cannot run there.
   An external scheduler (cron-job.org, UptimeRobot, Vercel Cron…) calls
   this endpoint instead. Protected by a shared secret so it is not public.

   Usage:  POST /api/cron/gmail-sync
           Header:  x-cron-secret: <CRON_SECRET>
       or  ?secret=<CRON_SECRET>
───────────────────────────────────────────────────────────────────────── */
const { runGmailSyncForAllUsers } = require('../jobs/gmailSync');

router.post('/cron/gmail-sync', async (req, res) => {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return res.status(503).json({ success: false, message: 'CRON_SECRET not configured' });
  }
  const provided = req.get('x-cron-secret') || req.query.secret;
  if (provided !== expected) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  try {
    const result = await runGmailSyncForAllUsers({ days: 2 });
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('[cron/gmail-sync]', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Lightweight keep-alive / uptime probe
router.get('/cron/ping', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// TEMP: synchronously run schema guards + report transactions column sizes.
router.get('/_schema-fix', async (_req, res) => {
  try {
    const { pool } = require('../db');
    const stmts = [
      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_pair_id UUID`,
      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_direction VARCHAR(10)`,
      `ALTER TABLE transactions ALTER COLUMN transfer_direction TYPE VARCHAR(10)`,
      `ALTER TABLE transactions ALTER COLUMN type TYPE VARCHAR(20)`,
      `ALTER TABLE transactions ALTER COLUMN status TYPE VARCHAR(20)`,
      `ALTER TABLE transactions ALTER COLUMN description TYPE TEXT`,
      `ALTER TABLE transactions ALTER COLUMN payment_name TYPE TEXT`,
      `ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_transfer_direction_check`,
    ];
    const applied = [];
    for (const sql of stmts) {
      try { await pool.query(sql); applied.push({ sql, ok: true }); }
      catch (e) { applied.push({ sql, ok: false, err: e.message }); }
    }
    const cols = await pool.query(
      `SELECT column_name, data_type, character_maximum_length
       FROM information_schema.columns WHERE table_name='transactions' ORDER BY ordinal_position`
    );
    res.json({ ok: true, applied, columns: cols.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
