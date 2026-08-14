const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { publishReviewRequest } = require('../kafka/producer');
const redis = require('redis');

const router = express.Router();

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect().catch(console.error);

/**
 * POST /api/v1/reviews
 * Submit a new code review request.
 * Body: { repo, branch, diff, pr_url?, commit_sha?, metadata? }
 */
router.post('/', async (req, res, next) => {
  try {
    const { repo, branch, diff, pr_url, commit_sha, metadata } = req.body;

    // Validate required fields
    if (!diff || diff.trim().length === 0) {
      return res.status(400).json({
        error: 'Missing required field: diff',
        hint: 'Provide a git diff string in the request body.',
      });
    }

    const reviewId = uuidv4();
    const reviewRequest = {
      reviewId,
      repo: repo || 'local',
      branch: branch || 'unknown',
      diff,
      pr_url: pr_url || null,
      commit_sha: commit_sha || null,
      metadata: metadata || {},
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store the review in Redis
    await redisClient.set(`review:${reviewId}`, JSON.stringify(reviewRequest));
    await redisClient.lPush('recent_reviews', reviewId);
    // keep only the last 100 for recent
    await redisClient.lTrim('recent_reviews', 0, 99);

    // Publish to Kafka for async processing
    await publishReviewRequest(reviewRequest);

    console.log(`📋 Review ${reviewId} queued for ${reviewRequest.repo}/${reviewRequest.branch}`);

    res.status(202).json({
      status: 'queued',
      reviewId,
      message: 'Review request accepted and queued for processing.',
      poll_url: `/api/v1/reviews/${reviewId}`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/reviews/:id
 * Get the status/result of a review.
 */
router.get('/:id', async (req, res) => {
  try {
    const reviewStr = await redisClient.get(`review:${req.params.id}`);

    if (!reviewStr) {
      return res.status(404).json({
        error: 'Review not found',
        reviewId: req.params.id,
      });
    }

    res.json(JSON.parse(reviewStr));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch review' });
  }
});

/**
 * GET /api/v1/reviews
 * List recent reviews (paginated).
 */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    
    const recentIds = await redisClient.lRange('recent_reviews', 0, limit - 1);
    const reviews = [];
    
    if (recentIds.length > 0) {
      const reviewKeys = recentIds.map(id => `review:${id}`);
      const reviewStrs = await redisClient.mGet(reviewKeys);
      reviewStrs.forEach(str => {
        if (str) reviews.push(JSON.parse(str));
      });
    }

    const total = await redisClient.lLen('recent_reviews');

    res.json({
      count: reviews.length,
      total,
      reviews,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch recent reviews' });
  }
});

/**
 * Update a review status (called internally by workers).
 */
async function updateReview(reviewId, updates) {
  try {
    const reviewStr = await redisClient.get(`review:${reviewId}`);
    if (reviewStr) {
      const review = JSON.parse(reviewStr);
      Object.assign(review, updates, { updatedAt: new Date().toISOString() });
      await redisClient.set(`review:${reviewId}`, JSON.stringify(review));
    }
  } catch (err) {
    console.error(`Failed to update review ${reviewId}:`, err);
  }
}

module.exports = router;
module.exports.updateReview = updateReview;
