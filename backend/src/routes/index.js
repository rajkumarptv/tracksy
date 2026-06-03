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

// WhatsApp — webhook is public (Twilio calls it), savePhone is protected
router.post('/whatsapp/webhook', waCtrl.webhook);
router.put('/whatsapp/phone', auth, waCtrl.savePhone);

// Admin — requires valid JWT + is_admin flag
router.get('/admin/stats',                    auth, adminAuth, adminCtrl.getStats);
router.get('/admin/users',                    auth, adminAuth, adminCtrl.getUsers);
router.patch('/admin/users/:userId/premium',  auth, adminAuth, adminCtrl.togglePremium);

// Admin — Family management
router.get('/admin/families',                       auth, adminAuth, adminCtrl.listFamilies);
router.post('/admin/families',                      auth, adminAuth, adminCtrl.createFamily);
router.patch('/admin/families/:familyId/members',   auth, adminAuth, adminCtrl.addFamilyMember);
router.delete('/admin/families/members/:userId',    auth, adminAuth, adminCtrl.removeFamilyMember);

// Family — primary member views family data
const familyCtrl = require('../controllers/familyController');
router.get('/family/status',        auth, familyCtrl.getStatus);
router.get('/family/overview',      auth, familyCtrl.getOverview);
router.get('/family/member/:id',    auth, familyCtrl.getMemberDetail);

module.exports = router;
