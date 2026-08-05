const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { publishReviewRequest } = require('../kafka/producer');

const router = express.Router();

// ─── In-memory review store (swap for Redis/DB in production) ───
const reviewStore = new Map();

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

    // Store the review
    reviewStore.set(reviewId, reviewRequest);

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
router.get('/:id', (req, res) => {
  const review = reviewStore.get(req.params.id);

  if (!review) {
    return res.status(404).json({
      error: 'Review not found',
      reviewId: req.params.id,
    });
  }

  res.json(review);
});

/**
 * GET /api/v1/reviews
 * List recent reviews (paginated).
 */
router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const reviews = Array.from(reviewStore.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);

  res.json({
    count: reviews.length,
    total: reviewStore.size,
    reviews,
  });
});

/**
 * Update a review status (called internally by workers).
 */
function updateReview(reviewId, updates) {
  const review = reviewStore.get(reviewId);
  if (review) {
    Object.assign(review, updates, { updatedAt: new Date().toISOString() });
    reviewStore.set(reviewId, review);
  }
}

module.exports = router;
module.exports.updateReview = updateReview;
module.exports.reviewStore = reviewStore;
