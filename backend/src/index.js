require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
require('./middleware/oauth'); // initialise passport strategies

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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
  // Works both locally (backend/src → ../../frontend/dist)
  // and on Render/Railway (started from repo root → frontend/dist)
  const buildPath = path.join(__dirname, '../../frontend/dist');

  // 1) Hashed JS/CSS assets — cache 1 year (safe: hash changes on each build)
  app.use('/assets', express.static(path.join(buildPath, 'assets'), {
    maxAge: '1y', immutable: true,
  }));

  // 2) All other static files (images, icons, manifest, sw.js etc.) — no cache
  app.use(express.static(buildPath, {
    maxAge: 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      }
    },
  }));

  // 3) SPA fallback — all remaining routes serve index.html
  app.get('*', (_req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
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
