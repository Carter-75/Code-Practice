require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const mongoose = require('mongoose');
const helmet = require('helmet');

const app = express();

let aiRouter;
try {
  aiRouter = require('./routes/ai');
} catch (err) {
  console.error('FATAL: Failed to load aiRouter:', err);
}

const indexRouter = require('./routes/index');

const PROJECT_NAME = process.env.PROJECT_NAME || 'Portfolio Project';

// --- MongoDB Setup ---
// Optional: no core feature depends on MongoDB. When no URI is configured the
// API runs normally without a database connection.
const mongoURI = process.env.MONGODB_URI;
if (mongoURI) {
  mongoose.connect(mongoURI)
    .then(() => console.log('OK: Connected to MongoDB'))
    .catch(err => {
      console.error('WARN: MongoDB Connection Error (Graceful):', err.message);
      console.log('INFO: Continuing without database features...');
    });
} else {
  console.log('INFO: No MONGODB_URI found. Continuing without a database connection.');
}

// --- Middlewares ---
app.use(cors());
app.use(logger('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// --- Portfolio Iframe Security ---
// Framing is governed by the CSP frame-ancestors directive below. The old
// X-Frame-Options: ALLOWALL header was removed: ALLOWALL is not a valid
// X-Frame-Options value, and modern browsers ignore the header when a
// frame-ancestors directive is present.
const frameAncestors = ["'self'", "https://carter-portfolio.fyi", "https://www.carter-portfolio.fyi", "https://carter-portfolio.vercel.app", "https://*.vercel.app", `http://localhost:${process.env.PORT || '3000'}`];
if (process.env.PROD_FRONTEND_URL) {
  frameAncestors.push(process.env.PROD_FRONTEND_URL);
}
if (process.env.PROD_BACKEND_URL) {
  frameAncestors.push(process.env.PROD_BACKEND_URL);
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "frame-ancestors": frameAncestors,
    },
  },
  frameguard: false,
}));

// --- Health Route ---
// Registered after the security middleware so responses carry the same
// headers as every other route. Reports only service status: no filesystem
// paths or environment details, this endpoint is public and unauthenticated.
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    env: process.env.PRODUCTION === 'true' ? 'production' : 'development',
    timestamp: new Date().toISOString()
  });
});

app.use('/api', indexRouter);
if (aiRouter) {
  app.use('/api/ai', aiRouter);
} else {
  app.use('/api/ai', (req, res) => {
    res.status(503).json({ error: 'AI services are currently unavailable due to an initialization failure.' });
  });
}

// JSON 404 for unknown API routes (instead of an HTML error page)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler: never leak internal error details on 500s
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) {
    console.error('Unhandled error:', err);
  }
  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : (err.message || 'Request failed')
  });
});

module.exports = app;
