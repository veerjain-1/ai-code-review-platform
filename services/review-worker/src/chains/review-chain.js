const { SecurityAgent } = require('../agents/security-agent');
const { QualityAgent } = require('../agents/quality-agent');
const { SynthesizerAgent } = require('../agents/synthesizer-agent');

class ReviewChain {
  constructor() {
    this.securityAgent = new SecurityAgent();
    this.qualityAgent = new QualityAgent();
    this.synthesizerAgent = new SynthesizerAgent();
  }

  /**
   * Run a code review on the given diff using local ONNX inference.
   * @param {string} diff - The git diff to review
   * @param {Object} context - Additional context (repo, branch, commit_sha)
   * @returns {Object} - Structured review result
   */
  async review(diff, context = {}) {
    // Truncate extremely large diffs to avoid token limits on the SLM
    const maxDiffLength = 8000; // Reduced for smaller local models
    const truncatedDiff = diff.length > maxDiffLength
      ? diff.substring(0, maxDiffLength) + '\n\n[... diff truncated due to size ...]'
      : diff;

    const startTime = Date.now();

    try {
      const state = {
        diff: truncatedDiff,
        repo: context.repo || 'unknown',
        branch: context.branch || 'unknown',
        commit_sha: context.commit_sha || 'unknown',
      };

      // Run specialized agents in parallel
      const [secResult, qualResult] = await Promise.all([
        this.securityAgent.run(state),
        this.qualityAgent.run(state)
      ]);
      
      state.security_issues = secResult.security_issues;
      state.quality_issues = qualResult.quality_issues;
      state.highlights = qualResult.highlights;

      // Run synthesizer
      const { final_review } = await this.synthesizerAgent.run(state);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`⏱️  Local SLM review completed in ${elapsed}s`);

      // Ensure metadata is filled
      if (!final_review.metadata) {
        final_review.metadata = {};
      }
      final_review.metadata.files_reviewed = final_review.metadata.files_reviewed || 0;
      final_review.metadata.total_additions = final_review.metadata.total_additions || 0;
      final_review.metadata.total_deletions = final_review.metadata.total_deletions || 0;
      final_review.metadata.languages_detected = final_review.metadata.languages_detected || [];

      return final_review;
    } catch (err) {
      console.error('❌ Local review failed:', err.message);

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
