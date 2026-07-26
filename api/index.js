/* Vercel serverless entry point.
   Vercel imports this module and calls the exported Express app per request.
   `src/index.js` skips app.listen()/node-cron when process.env.VERCEL is set.

   Wrapped in a loader guard so any module-load failure surfaces as a readable
   HTTP 500 body (with the stack) instead of an opaque FUNCTION_INVOCATION_FAILED. */
let app;
let loadError = null;
try {
  app = require('../backend/src/index.js');
} catch (e) {
  loadError = e;
}

module.exports = (req, res) => {
  if (loadError) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({
      loadError: true,
      message: loadError.message,
      stack: String(loadError.stack || '').split('\n').slice(0, 8),
    }));
  }
  return app(req, res);
};
