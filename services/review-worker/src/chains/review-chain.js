const { createReviewGraph } = require('../graphs/review-graph');

class ReviewChain {
  constructor() {
    this.graph = createReviewGraph();
  }

  /**
   * Run a code review on the given diff using the Multi-Agent LangGraph workflow.
   * @param {string} diff - The git diff to review
   * @param {Object} context - Additional context (repo, branch, commit_sha)
   * @returns {Object} - Structured review result
   */
  async review(diff, context = {}) {
    // Truncate extremely large diffs to avoid token limits
    const maxDiffLength = 50000;
    const truncatedDiff = diff.length > maxDiffLength
      ? diff.substring(0, maxDiffLength) + '\n\n[... diff truncated due to size ...]'
      : diff;

    const startTime = Date.now();

    try {
      // Invoke the LangGraph workflow
      const state = await this.graph.invoke({
        diff: truncatedDiff,
        repo: context.repo || 'unknown',
        branch: context.branch || 'unknown',
        commit_sha: context.commit_sha || 'unknown',
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`⏱️  Multi-Agent LLM review completed in ${elapsed}s`);

      const finalReview = state.final_review;
      
      // Ensure metadata is filled
      if (!finalReview.metadata) {
        finalReview.metadata = {};
      }
      finalReview.metadata.files_reviewed = finalReview.metadata.files_reviewed || 0;
      finalReview.metadata.total_additions = finalReview.metadata.total_additions || 0;
      finalReview.metadata.total_deletions = finalReview.metadata.total_deletions || 0;
      finalReview.metadata.languages_detected = finalReview.metadata.languages_detected || [];

      return finalReview;
    } catch (err) {
      console.error('❌ LangGraph review failed:', err.message);

      // Return a fallback result on LLM failure
      return {
        summary: `Review failed: ${err.message}`,
        score: 0,
        issues: [],
        highlights: [],
        metadata: {
          files_reviewed: 0,
          total_additions: 0,
          total_deletions: 0,
          languages_detected: [],
          error: err.message,
        },
      };
    }
  }
}

module.exports = { ReviewChain };
