const { SecurityAgent } = require('../agents/security-agent');
const { QualityAgent } = require('../agents/quality-agent');
const { ArchitectureAgent } = require('../agents/architecture-agent');
const { SynthesizerAgent } = require('../agents/synthesizer-agent');
const { computeDiffStats } = require('../utils/diff-stats');
const { RuleChecker } = require('../utils/rule-checker');

class ReviewChain {
  constructor() {
    this.securityAgent = new SecurityAgent();
    this.qualityAgent = new QualityAgent();
    this.architectureAgent = new ArchitectureAgent();
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
      // 1. Fast deterministic static rule scanning (zero inference latency)
      const staticIssues = RuleChecker.scan(diff);

      const state = {
        diff: truncatedDiff,
        repo: context.repo || 'unknown',
        branch: context.branch || 'unknown',
        commit_sha: context.commit_sha || 'unknown',
      };

      // 2. Run specialized agents in parallel
      const [secResult, qualResult, archResult] = await Promise.all([
        this.securityAgent.run(state),
        this.qualityAgent.run(state),
        this.architectureAgent.run(state),
      ]);
      
      const staticSecurity = staticIssues.filter(i => i.category === 'security');
      const staticQuality = staticIssues.filter(i => i.category !== 'security');

      state.security_issues = [...staticSecurity, ...(secResult.security_issues || [])];
      state.quality_issues = [...staticQuality, ...(qualResult.quality_issues || []), ...(archResult.architecture_issues || [])];
      state.highlights = qualResult.highlights || [];
      state.breaking_changes = archResult.breaking_changes || [];

      // 3. Run synthesizer to deduplicate and score
      const { final_review } = await this.synthesizerAgent.run(state);
      if (state.breaking_changes.length > 0) {
        final_review.breaking_changes = state.breaking_changes;
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`⏱️  Local SLM review completed in ${elapsed}s`);

      // Compute real metadata from the full (untruncated) diff -- the LLM
      // agents only see the truncated diff for context-length reasons, but
      // file/line/language stats should reflect the actual change.
      const diffStats = computeDiffStats(diff);

      if (!final_review.metadata) {
        final_review.metadata = {};
      }
      final_review.metadata.files_reviewed = diffStats.filesReviewed;
      final_review.metadata.total_additions = diffStats.totalAdditions;
      final_review.metadata.total_deletions = diffStats.totalDeletions;
      final_review.metadata.languages_detected = diffStats.languagesDetected;

      return final_review;
    } catch (err) {
      console.error('❌ Local review failed:', err.message);

      // Return a fallback result on LLM failure. Metadata is still computed
      // from the real diff so a synthesis/LLM failure doesn't also hide
      // the (cheap, local) file/line/language stats.
      const diffStats = computeDiffStats(diff);

      return {
        summary: `Review failed: ${err.message}`,
        score: 0,
        issues: [],
        highlights: [],
        metadata: {
          files_reviewed: diffStats.filesReviewed,
          total_additions: diffStats.totalAdditions,
          total_deletions: diffStats.totalDeletions,
          languages_detected: diffStats.languagesDetected,
          error: err.message,
        },
      };
    }
  }
}

module.exports = { ReviewChain };
