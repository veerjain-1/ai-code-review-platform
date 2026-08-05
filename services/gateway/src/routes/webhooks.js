const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { publishReviewRequest } = require('../kafka/producer');

const router = express.Router();

/**
 * POST /api/v1/webhooks/github
 * Receive GitHub webhook events (pull_request opened/synchronized).
 */
router.post('/github', async (req, res, next) => {
  try {
    const event = req.headers['x-github-event'];
    const signature = req.headers['x-hub-signature-256'];

    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const hmac = crypto.createHmac('sha256', webhookSecret);
      const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    // Only process pull_request events
    if (event !== 'pull_request') {
      return res.status(200).json({ message: `Ignoring event: ${event}` });
    }

    const { action, pull_request, repository } = req.body;

    // Only review on opened or synchronized (new push to PR)
    if (!['opened', 'synchronize'].includes(action)) {
      return res.status(200).json({ message: `Ignoring PR action: ${action}` });
    }

    const reviewId = uuidv4();
    const reviewRequest = {
      reviewId,
      repo: repository.full_name,
      branch: pull_request.head.ref,
      diff: null,  // Worker will fetch the diff via GitHub API
      pr_url: pull_request.html_url,
      pr_number: pull_request.number,
      commit_sha: pull_request.head.sha,
      base_sha: pull_request.base.sha,
      metadata: {
        source: 'github-webhook',
        author: pull_request.user.login,
        title: pull_request.title,
        additions: pull_request.additions,
        deletions: pull_request.deletions,
        changed_files: pull_request.changed_files,
      },
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
    };

    await publishReviewRequest(reviewRequest);

    console.log(`🔔 Webhook: PR #${pull_request.number} on ${repository.full_name} queued as ${reviewId}`);

    res.status(202).json({
      status: 'queued',
      reviewId,
      message: `PR #${pull_request.number} queued for AI review.`,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
