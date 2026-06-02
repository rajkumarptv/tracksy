const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authCtrl = require('../controllers/authController');
const dashCtrl = require('../controllers/dashboardController');
const txCtrl = require('../controllers/transactionController');
const budgetCtrl = require('../controllers/budgetController');
const res0 = require('../controllers/resourceController');

// Auth
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.get('/auth/me', auth, authCtrl.getMe);
router.put('/auth/profile', auth, authCtrl.updateProfile);

// Dashboard
router.get('/dashboard/summary', auth, dashCtrl.getSummary);
router.get('/dashboard/money-flow', auth, dashCtrl.getMoneyFlow);
router.get('/dashboard/recent-transactions', auth, dashCtrl.getRecentTransactions);

// Transactions
router.get('/transactions', auth, txCtrl.getAll);
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

// Data management
router.get('/data/export', auth, res0.exportData);
router.post('/data/reset', auth, res0.resetData);

// Categories
router.get('/categories', auth, res0.getAllCategories);
router.post('/categories', auth, res0.createCategory);
router.put('/categories/:id', auth, res0.updateCategory);
router.delete('/categories/:id', auth, res0.deleteCategory);

module.exports = router;
