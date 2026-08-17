const { Octokit } = require('@octokit/rest');

class GithubPublisher {
  constructor() {
    if (process.env.GITHUB_TOKEN) {
      this.octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
      });
    } else {
      this.octokit = null;
      console.warn('⚠️  GITHUB_TOKEN not set — PR commenting disabled');
    }
  }

  /**
   * Post an AI review as a PR review.
   * @param {string} repoFullName - e.g. "owner/repo"
   * @param {number} prNumber - Pull request number
   * @param {Object} reviewResult - The structured review result
   * @param {string} commitSha - The commit SHA to attach the review to
   */
  async postReview(repoFullName, prNumber, reviewResult, commitSha) {
    if (!this.octokit) {
      console.warn('⚠️  Skipping GitHub publish — no token configured');
      return;
    }

    const [owner, repo] = repoFullName.split('/');
    
    // Determine review event based on severity
    const hasCritical = reviewResult.issues.some(i => i.severity === 'CRITICAL');
    const event = hasCritical ? 'REQUEST_CHANGES' : 'COMMENT';
    
    const body = this._formatReviewSummary(reviewResult);
    
    // Create line-by-line comments
    const comments = [];
    for (const issue of reviewResult.issues) {
      // Ensure we have a valid line number and file path
      if (issue.file && issue.file !== 'unknown' && issue.line_end > 0) {
        comments.push({
          path: issue.file,
          line: issue.line_end, // using line_end to place it at the end of the issue block
          body: this._formatSingleIssue(issue)
        });
      }
    }

    try {
      console.log(`💬 Attempting to post structured PR Review (Event: ${event}) with ${comments.length} line comments...`);
      await this.octokit.pulls.createReview({
        owner,
        repo,
        pull_number: prNumber,
        commit_id: commitSha,
        event,
        body,
        comments
      });
    } catch (err) {
      console.warn(`⚠️  Failed to create structured PR review: ${err.message}`);
      console.warn('⚠️  Falling back to single PR issue comment...');
      
      // Fallback: Post everything as a single comment
      const fallbackBody = this._formatReviewComment(reviewResult);
      await this.octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: fallbackBody,
      });
    }
  }
  
  _formatSingleIssue(issue) {
    const severityEmoji = {
      CRITICAL: '🔴',
      WARNING: '🟡',
      INFO: '🔵',
    };
    const emoji = severityEmoji[issue.severity] || severityEmoji.INFO;
    
    let comment = `**${emoji} ${issue.severity} [${issue.category}]**: ${issue.title}\n\n`;
    comment += `${issue.description}\n\n`;
    if (issue.suggestion) {
      comment += `**Suggested Fix:**\n\`\`\`\n${issue.suggestion}\n\`\`\`\n`;
    }
    return comment;
  }

  _formatReviewSummary(result) {
    const scoreBar = '█'.repeat(result.score) + '░'.repeat(10 - result.score);

    let comment = `## 🤖 AI Code Review\n\n`;
    comment += `**Score:** \`[${scoreBar}]\` **${result.score}/10**\n\n`;
    comment += `**Summary:** ${result.summary}\n\n`;

    // Highlights
    if (result.highlights && result.highlights.length > 0) {
      comment += `### 🌟 Highlights\n\n`;
      result.highlights.forEach((h) => {
        comment += `- ${h}\n`;
      });
      comment += '\n';
    }

    // Metadata
    if (result.metadata) {
      comment += `---\n`;
      comment += `<sub>📊 Files reviewed: ${result.metadata.files_reviewed} | `;
      comment += `+${result.metadata.total_additions} / -${result.metadata.total_deletions} | `;
      comment += `Languages: ${result.metadata.languages_detected?.join(', ') || 'N/A'} | `;
      comment += `Powered by AI Code Review Platform</sub>\n`;
    }

    return comment;
  }

  /**
   * Format the review result into a GitHub-flavored markdown comment.
   * Used exclusively for the fallback mechanism.
   */
  _formatReviewComment(result) {
    const severityEmoji = {
      CRITICAL: '🔴',
      WARNING: '🟡',
      INFO: '🔵',
    };

    const scoreBar = '█'.repeat(result.score) + '░'.repeat(10 - result.score);

    let comment = `## 🤖 AI Code Review (Fallback Mode)\n\n`;
    comment += `*Note: The native line-by-line review failed, likely due to a diff line mapping mismatch.*\n\n`;
    comment += `**Score:** \`[${scoreBar}]\` **${result.score}/10**\n\n`;
    comment += `**Summary:** ${result.summary}\n\n`;

    // Issues
    if (result.issues.length > 0) {
      comment += `### Issues Found (${result.issues.length})\n\n`;

      // Group by severity
      const grouped = { CRITICAL: [], WARNING: [], INFO: [] };
      result.issues.forEach((issue) => {
        if (grouped[issue.severity]) {
          grouped[issue.severity].push(issue);
        }
      });

      for (const [severity, issues] of Object.entries(grouped)) {
        if (issues.length === 0) continue;

        comment += `#### ${severityEmoji[severity]} ${severity} (${issues.length})\n\n`;

        issues.forEach((issue) => {
          comment += `<details>\n`;
          comment += `<summary><b>${issue.title}</b> — <code>${issue.file}:${issue.line_start}</code></summary>\n\n`;
          comment += `**Category:** ${issue.category} | **Confidence:** ${(issue.confidence * 100).toFixed(0)}%\n\n`;
          comment += `${issue.description}\n\n`;
          if (issue.suggestion) {
            comment += `**Suggested Fix:**\n\`\`\`\n${issue.suggestion}\n\`\`\`\n\n`;
          }
          comment += `</details>\n\n`;
        });
      }
    } else {
      comment += `### ✅ No Issues Found\n\nGreat work! The code looks clean.\n\n`;
    }

    // Highlights
    if (result.highlights && result.highlights.length > 0) {
      comment += `### 🌟 Highlights\n\n`;
      result.highlights.forEach((h) => {
        comment += `- ${h}\n`;
      });
      comment += '\n';
    }

    // Metadata
    if (result.metadata) {
      comment += `---\n`;
      comment += `<sub>📊 Files reviewed: ${result.metadata.files_reviewed} | `;
      comment += `+${result.metadata.total_additions} / -${result.metadata.total_deletions} | `;
      comment += `Languages: ${result.metadata.languages_detected?.join(', ') || 'N/A'} | `;
      comment += `Powered by AI Code Review Platform</sub>\n`;
    }

    return comment;
  }
}

module.exports = { GithubPublisher };
