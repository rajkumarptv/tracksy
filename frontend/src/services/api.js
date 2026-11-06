import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tracksy_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('tracksy_token');
      localStorage.removeItem('tracksy_user');
      localStorage.removeItem('tracksy-cache');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  saveWhatsappPhone: (phone) => api.put('/whatsapp/phone', { whatsapp_phone: phone }),
  changePassword: (data) => api.post('/auth/change-password', data),
  getNotificationPrefs: () => api.get('/auth/notification-preferences'),
  updateNotificationPrefs: (data) => api.put('/auth/notification-preferences', data),
};

// Dashboard
export const dashboardAPI = {
  summary: (params) => api.get('/dashboard/summary', { params }),
  moneyFlow: (params) => api.get('/dashboard/money-flow', { params }),
  recentTransactions: (params) => api.get('/dashboard/recent-transactions', { params }),
  categoryBreakdown: (params) => api.get('/dashboard/category-breakdown', { params }),
  analyticsStats: (params) => api.get('/dashboard/analytics-stats', { params }),
  balanceHistory: (params) => api.get('/dashboard/balance-history', { params }),
};

export const analyticsAPI = {
  overview: (params) => api.get('/analytics/overview', { params }),
};

// Transactions
export const transactionsAPI = {
  getAll: (params) => api.get('/transactions', { params }),
  getById: (id) => api.get(`/transactions/${id}`),
  create: (data) => api.post('/transactions', data),
  update: (id, data) => api.put(`/transactions/${id}`, data),
  delete: (id) => api.delete(`/transactions/${id}`),
  exportCSV: (params) => api.get('/transactions/export/csv', { params, responseType: 'blob' }),
};

// Bills (receipt attachments per transaction)
export const billsAPI = {
  upload: (txId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/transactions/${txId}/bills`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  getAll: (txId) => api.get(`/transactions/${txId}/bills`),
  fileUrl: (billId) => {
    const base = import.meta.env.VITE_API_URL || '/api';
    return `${base}/bills/${billId}/file`;
  },
  delete: (billId) => api.delete(`/bills/${billId}`),
};

// Budgets
export const budgetsAPI = {
  getAll: (params) => api.get('/budgets', { params }),
  create: (data) => api.post('/budgets', data),
  update: (id, data) => api.put(`/budgets/${id}`, data),
  delete: (id) => api.delete(`/budgets/${id}`),
};

// Goals
export const goalsAPI = {
  getAll: () => api.get('/goals'),
  create: (data) => api.post('/goals', data),
  update: (id, data) => api.put(`/goals/${id}`, data),
  addFunds: (id, amount) => api.post(`/goals/${id}/add-funds`, { amount }),
  delete: (id) => api.delete(`/goals/${id}`),
};

// Wallets
export const walletsAPI = {
  getAll: () => api.get('/wallets'),
  create: (data) => api.post('/wallets', data),
  update: (id, data) => api.put(`/wallets/${id}`, data),
  delete: (id) => api.delete(`/wallets/${id}`),
  reconcile: (id, actual_balance) => api.post(`/wallets/${id}/reconcile`, { actual_balance }),
  pay: (id, data) => api.post(`/wallets/${id}/payment`, data),
};

// Recurring transactions
export const recurringAPI = {
  getAll: () => api.get('/recurring'),
  create: (data) => api.post('/recurring', data),
  update: (id, data) => api.put(`/recurring/${id}`, data),
  delete: (id) => api.delete(`/recurring/${id}`),
  process: () => api.post('/recurring/process'),
};

// Net worth
export const netWorthAPI = {
  history: () => api.get('/net-worth/history'),
  snapshot: () => api.post('/net-worth/snapshot'),
};

// Categories
export const categoriesAPI = {
  getAll: () => api.get('/categories'),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
};

// Data management
export const dataAPI = {
  export: () => api.get('/data/export'),
  reset:  (scope) => api.post('/data/reset', { scope }),
  sampleStatus: () => api.get('/data/sample/status'),
  sampleLoad:   () => api.post('/data/sample'),
  sampleRemove: () => api.delete('/data/sample'),
};

// Family budget
export const familyAPI = {
  status:       () => api.get('/family/status'),
  create:       (name) => api.post('/family/create', { name }),
  join:         (code) => api.post('/family/join', { code }),
  leave:        () => api.post('/family/leave'),
  removeMember: (memberId) => api.post('/family/remove-member', { member_id: memberId }),
  overview:     () => api.get('/family/overview'),
  memberDetail: (id) => api.get(`/family/member/${id}`),
};

// Compress a receipt image in the browser before upload.
// Why: Vercel serverless rejects request bodies over ~4.5 MB at the edge, so
// large mobile photos/screenshots fail before reaching the function. Downscaling
// to <=1600px JPEG keeps uploads tiny (usually <300 KB) and also cuts the image
// tokens the vision model is billed for. Falls back to the original file if the
// browser can't decode it (e.g. HEIC) so the server can still try.
async function compressImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const MAX = 1600;
    const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.8));
    if (!blob) return file;
    return new File([blob], 'receipt.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

// Receipt screenshot OCR (share-target / upload)
export const receiptAPI = {
  scan: async (file) => {
    const compressed = await compressImage(file);
    const fd = new FormData();
    fd.append('file', compressed, 'receipt.jpg');
    return api.post('/receipt/scan', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// Broker integrations
export const brokerAPI = {
  dhanHoldings: (access_token, client_id) => api.post('/broker/dhan/holdings', { access_token, client_id }),
};

// Bank statement import
export const importAPI = {
  preview:    (formData) => api.post('/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  reconcile:  (transactions)              => api.post('/import/reconcile', { transactions }),
  confirm:    (transactions, wallet_id)   => api.post('/import/confirm',   { transactions, wallet_id }),
};

export default api;
