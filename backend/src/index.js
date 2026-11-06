require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const routes = require('./routes');
require('./middleware/oauth'); // initialise passport strategies
require('./db/ensureColumns')().catch(() => {}); // idempotent schema guards

const app = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

// Gzip every response (API JSON + JS/CSS) — big win on mobile networks
app.use(compression({ level: 6, threshold: 512 }));

// Allowed front-end origins (comma-separated CLIENT_URL/FRONTEND_URL + localhost + *.vercel.app)
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  'https://app.topfindstoday.in',
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    // allow same-origin / curl (no origin), listed origins, and any *.vercel.app preview
    if (!origin || allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin)) return cb(null, true);
    return cb(null, true); // be permissive — JWT-protected API, no cookies
  },
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

// Serve React build only if it exists (local/tunnel setup).
// On Render the frontend lives on Vercel, so this is skipped → API-only.
const fs = require('fs');
const buildPath = path.join(__dirname, '../../frontend/dist');
const serveFrontend = isProd && fs.existsSync(path.join(buildPath, 'index.html'));

if (serveFrontend) {
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
  // API-only (Render / dev): non-API routes return JSON 404
  app.get('/', (_req, res) => res.json({ status: 'Tracksy API', ok: true }));
  app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
}

// Error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

/* ═══════════════════════════════════════════════════════════════════════
   Serverless vs long-running
   ───────────────────────────
   On Vercel the platform imports this module and invokes `app` per request —
   there is no port to listen on and no always-on process, so `app.listen()`
   and background timers must NOT run. We detect that via VERCEL and only start a
   real server when this file is executed directly (local / VPS / Render).

═══════════════════════════════════════════════════════════════════════ */
const isServerless = !!process.env.VERCEL;

if (!isServerless) {
  app.listen(PORT, () => {
    console.log(`\n🚀 Tracksy API running on http://localhost:${PORT}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
    if (isProd) {
      console.log(`🌐 Serving React build from ../frontend/dist`);
    }
    console.log(`🗄️  DB: ${process.env.DATABASE_URL ? 'Cloud (DATABASE_URL)' : `${process.env.DB_NAME}@${process.env.DB_HOST}`}\n`);
  });

}

module.exports = app;
