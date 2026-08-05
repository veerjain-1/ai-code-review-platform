require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { connectProducer, disconnectProducer } = require('./kafka/producer');
const reviewRoutes = require('./routes/reviews');
const healthRoutes = require('./routes/health');
const webhookRoutes = require('./routes/webhooks');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security Middleware ───
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
}));

// ─── Rate Limiting ───
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// ─── Body Parsing ───
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Request Logging ───
app.use(morgan('combined'));

// ─── Routes ───
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/webhooks', webhookRoutes);

// ─── Root ───
app.get('/', (req, res) => {
  res.json({
    service: 'AI Code Review Gateway',
    version: '1.0.0',
    docs: '/api/v1/health',
  });
});

// ─── 404 Handler ───
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Error Handler ───
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`, err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ─── Startup ───
async function start() {
  try {
    await connectProducer();
    console.log('✅ Kafka producer connected');

    app.listen(PORT, () => {
      console.log(`🚀 AI Review Gateway running on http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('❌ Failed to start gateway:', err);
    process.exit(1);
  }
}

// ─── Graceful Shutdown ───
async function shutdown(signal) {
  console.log(`\n🔻 Received ${signal}. Shutting down gracefully...`);
  await disconnectProducer();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();

module.exports = app;
