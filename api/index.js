/* Vercel serverless entry point.
   Vercel imports this module and calls the exported Express app per request.
   `src/index.js` skips app.listen()/node-cron when process.env.VERCEL is set. */
module.exports = require('../backend/src/index.js');
