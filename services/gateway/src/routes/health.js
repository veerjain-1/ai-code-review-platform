const express = require('express');
const { kafka } = require('../kafka/producer');

const router = express.Router();

/**
 * GET /api/v1/health
 * Health check endpoint.
 */
router.get('/', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'ai-review-gateway',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // Check Kafka connectivity
  try {
    const admin = kafka.admin();
    await admin.connect();
    const topics = await admin.listTopics();
    await admin.disconnect();
    health.checks.kafka = {
      status: 'connected',
      topics: topics.filter(t => t.startsWith('code-review') || t.startsWith('gate-check') || t.startsWith('review-')),
    };
  } catch (err) {
    health.checks.kafka = { status: 'disconnected', error: err.message };
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;
