/**
 * Standardized Pull Request Review Formatter.
 * Generates structured, GitHub-flavored Markdown reports with
 * score badges, severity categorization, breaking change notices, and suggested fixes.
 */

const SEVERITY_ICONS = {
  CRITICAL: '🛑',
  WARNING: '⚠️',
  INFO: 'ℹ️',
};

const CATEGORY_TAGS = {
  security: '🛡️ Security',
  performance: '⚡ Performance',
  'code-quality': '✨ Quality',
  architecture: '🏛️ Architecture',
  'breaking-change': '💥 Breaking Change',
  maintainability: '🔧 Maintainability',
  resilience: '🔄 Resilience',
};

class PRFormatter {
  /**
   * Format full PR review summary comment.
   * @param {Object} result - Review payload
   * @returns {string} Markdown formatted review
   */
  static formatSummary(result) {
    const score = typeof result.score === 'number' ? Math.max(0, Math.min(10, result.score)) : 5;
    const scoreBar = '█'.repeat(score) + '░'.repeat(10 - score);
    const scoreColor = score >= 8 ? 'brightgreen' : score >= 6 ? 'yellow' : 'red';
    const issues = result.issues || [];
    const breakingChanges = result.breaking_changes || [];

    let md = `## 🤖 AI Code Review & Security Analysis\n\n`;

    // Badges & Score
    md += `![Review Score](https://img.shields.io/badge/Review%20Score-${score}%2F10-${scoreColor}) `;
    md += `![Issues](https://img.shields.io/badge/Issues-${issues.length}-informational)\n\n`;
    md += `**Score:** \`[${scoreBar}]\` **${score}/10**\n\n`;
    md += `> **Executive Summary:** ${result.summary || 'Review completed.'}\n\n`;

    // Breaking Changes Callout
    if (breakingChanges.length > 0) {
      md += `### 💥 Potential Breaking Changes\n\n`;
      for (const bc of breakingChanges) {
        md += `- ⚠️ **${bc}**\n`;
      }
      md += '\n';
    }

    // Issues Breakdown Table
    if (issues.length > 0) {
      md += `### 📋 Detected Findings (${issues.length})\n\n`;
      md += `| Severity | Category | File:Line | Title |\n`;
      md += `| :---: | :--- | :--- | :--- |\n`;
      for (const issue of issues.slice(0, 15)) {
        const icon = SEVERITY_ICONS[issue.severity] || 'ℹ️';
        const cat = CATEGORY_TAGS[issue.category] || issue.category;
        const location = issue.file ? `\`${issue.file}:${issue.line_start || 1}\`` : 'N/A';
        md += `| ${icon} **${issue.severity}** | ${cat} | ${location} | ${issue.title} |\n`;
      }
      md += '\n';

      // Collapsible details per issue
      md += `<details>\n<summary><b>🔍 View Detailed Findings & Remediation Code</b></summary>\n\n`;
      for (const issue of issues) {
        const icon = SEVERITY_ICONS[issue.severity] || 'ℹ️';
        md += `#### ${icon} [${issue.severity}] ${issue.title}\n`;
        md += `- **Location:** \`${issue.file || 'unknown'}:${issue.line_start || 1}\`\n`;
        md += `- **Category:** ${issue.category} | **Confidence:** ${Math.round((issue.confidence || 0.8) * 100)}%\n\n`;
        md += `${issue.description}\n\n`;
        if (issue.suggestion) {
          md += `**Suggested Fix:**\n\`\`\`diff\n${issue.suggestion}\n\`\`\`\n\n`;
        }
      }
      md += `</details>\n\n`;
    } else {
      md += `### ✅ Clean Review\nNo architectural, performance, or security regressions were flagged in this diff.\n\n`;
    }

    // Positive Highlights
    if (result.highlights && result.highlights.length > 0) {
      md += `### 🌟 Highlights & Commendations\n\n`;
      for (const h of result.highlights) {
        md += `- ✨ ${h}\n`;
      }
      md += '\n';
    }

    // Metadata Footer
    md += `---\n`;
    const meta = result.metadata || {};
    md += `<sub>📊 Files: ${meta.files_reviewed || 0} | Lines: +${meta.total_additions || 0} / -${meta.total_deletions || 0} | Languages: ${(meta.languages_detected || []).join(', ') || 'N/A'} | Powered by @ai-review/review-worker</sub>\n`;

    return md;
  }

  /**
   * Format a single inline line comment.
   */
  static formatSingleIssue(issue) {
    const icon = SEVERITY_ICONS[issue.severity] || 'ℹ️';
    let comment = `**${icon} ${issue.severity} [${issue.category}]**: ${issue.title}\n\n`;
    comment += `${issue.description}\n\n`;
    if (issue.suggestion) {
      comment += `**Suggested Fix:**\n\`\`\`suggestion\n${issue.suggestion}\n\`\`\`\n`;
    }
    return comment;
  }
}

module.exports = { PRFormatter, SEVERITY_ICONS, CATEGORY_TAGS };
