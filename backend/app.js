require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const mongoose = require('mongoose');
const helmet = require('helmet');

const indexRouter = require('./routes/index');
const aiRouter = require('./routes/ai');

const app = express();

// Temporary route for AI to view screenshots during curriculum extraction
app.use('/debug/images', express.static(path.join(__dirname, '../temp_prompt_extract/Prompt')));

const PROJECT_NAME = process.env.PROJECT_NAME || 'Portfolio Project';

// --- MongoDB Setup ---
const mongoURI = process.env.MONGODB_URI;
if (mongoURI) {
  mongoose.connect(mongoURI)
    .then(() => console.log('OK: Connected to MongoDB'))
    .catch(err => {
      console.error('WARN: MongoDB Connection Error (Graceful):', err.message);
      console.log('INFO: Continuing without database features...');
    });
} else {
  console.log('INFO: No MONGODB_URI found in .env. Database features disabled.');
}

// --- Middlewares ---
app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// --- Portfolio Iframe Security ---
const isProd = process.env.PRODUCTION === 'true';
const prodUrl = process.env.PROD_FRONTEND_URL;

const frameAncestors = ["'self'", "https://carter-portfolio.fyi", "https://carter-portfolio.vercel.app", "https://*.vercel.app", `http://localhost:${process.env.PORT || '3000'}`];
if (isProd && prodUrl) {
  frameAncestors.push(prodUrl);
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "frame-ancestors": frameAncestors,
    },
  },
}));

app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'ALLOWALL'); // For compatibility
  next();
});

app.get('/', (req, res) => {
  res.send(`API for ${PROJECT_NAME} is running at /api`);
});

app.use('/api', indexRouter);
app.use('/api/ai', aiRouter);

// Error handler
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    message: err.message,
    error: req.app.get('env') === 'development' ? err : {}
  });
});

module.exports = app;
