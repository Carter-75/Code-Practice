// Vercel serverless entrypoint.
// The Express app itself lives in ../app.js (also used by bin/www for local
// development). Routing every request through this api/ function is the
// deployment shape Vercel supports for Express: a root-level rewrite to
// app.js passes the rewritten path (/app.js) to the handler instead of the
// original URL, which broke every /api route.
module.exports = require('../app');
