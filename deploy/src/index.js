require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors({
  origin: isProd
    ? [process.env.CLIENT_URL || 'https://app.topfindstoday.in']
    : (process.env.CLIENT_URL || 'http://localhost:3000'),
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger (dev only)
if (!isProd) {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// API Routes
app.use('/api', routes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Serve React build in production
if (isProd) {
  const buildPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(buildPath));
  // All non-API routes serve the React app (SPA fallback)
  app.get('*', (_req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
} else {
  // 404 for API-only dev mode
  app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
}

// Error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Tracksy API running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  if (isProd) {
    console.log(`🌐 Serving React build from ../frontend/dist`);
  }
  console.log(`🗄️  DB: ${process.env.DATABASE_URL ? 'Cloud (DATABASE_URL)' : `${process.env.DB_NAME}@${process.env.DB_HOST}`}\n`);
});
