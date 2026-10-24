/**
 * Fast deterministic static rule checker for git diffs.
 * Scans added lines for hardcoded credentials, security anti-patterns,
 * and leftover debugging constructs without requiring LLM inference.
 */

const SECRET_PATTERNS = [
  {
    id: 'sec-aws-key',
    regex: /\b(AKIA[0-9A-Z]{16})\b/,
    title: 'Hardcoded AWS Access Key ID Detected',
    severity: 'CRITICAL',
    description: 'Found AWS Access Key ID directly in source code. Credentials must be injected via environment variables or secret managers.',
    suggestion: 'Use process.env.AWS_ACCESS_KEY_ID instead of hardcoding credentials.',
  },
  {
    id: 'sec-github-token',
    regex: /\b(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})\b/,
    title: 'Hardcoded GitHub Personal Access Token',
    severity: 'CRITICAL',
    description: 'A GitHub personal access token was committed in the diff. Revoke this token immediately.',
    suggestion: 'Store the GitHub token in repository secrets or environment variables.',
  },
  {
    id: 'sec-slack-webhook',
    regex: /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Z_]+\/B[0-9A-Z_]+\/[0-9A-Za-z]+/,
    title: 'Hardcoded Slack Incoming Webhook URL',
    severity: 'CRITICAL',
    description: 'Slack incoming webhook URL exposed in diff, allowing unauthorized message posting to your workspace.',
    suggestion: 'Store webhook URLs in environment variables (e.g. SLACK_WEBHOOK_URL).',
  },
  {
    id: 'sec-private-key',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
    title: 'Cryptographic Private Key in Source Code',
    severity: 'CRITICAL',
    description: 'A raw private key header was detected. Storing private keys in source control poses severe security risk.',
    suggestion: 'Load private keys at runtime from AWS Secrets Manager, Vault, or secure environment files.',
  },
];

const ANTI_PATTERNS = [
  {
    id: 'anti-eval',
    regex: /\beval\s*\(/,
    title: 'Use of eval() Detected',
    severity: 'CRITICAL',
    description: 'eval() executes arbitrary code in caller context, opening the application to severe code injection vulnerabilities.',
    suggestion: 'Refactor code to avoid dynamic evaluation; use JSON.parse() or dedicated parser logic.',
  },
  {
    id: 'anti-dangerously-set-inner-html',
    regex: /dangerouslySetInnerHTML\s*=/,
    title: 'Direct HTML Injection via dangerouslySetInnerHTML',
    severity: 'WARNING',
    description: 'dangerouslySetInnerHTML bypasses React\'s built-in XSS protection. If user-controlled data reaches this prop, XSS is possible.',
    suggestion: 'Sanitize HTML input using DOMPurify before passing to dangerouslySetInnerHTML.',
  },
  {
    id: 'anti-console-log',
    regex: /\bconsole\.(?:log|debug|info)\s*\(/,
    title: 'Production Logging Anti-Pattern (console.log)',
    severity: 'INFO',
    description: 'Raw console.log calls pollute runtime stdout and can leak sensitive payload data into unindexed logs.',
    suggestion: 'Use a structured logger (e.g., Winston, Pino) with log levels and redaction filters.',
  },
  {
    id: 'anti-debugger',
    regex: /\bdebugger\s*;?/,
    title: 'Leftover Debugger Statement',
    severity: 'WARNING',
    description: 'A debugger statement was left in the code, which halts execution if dev tools are attached in runtime environments.',
    suggestion: 'Remove debugger breakpoint statement before merging.',
  },
];

class RuleChecker {
  /**
   * Scan a git diff string for static rule violations.
   * @param {string} diff - Unified diff
   * @returns {Array<Object>} List of detected issues
   */
  static scan(diff) {
    if (!diff || typeof diff !== 'string') {
      return [];
    }

    const issues = [];
    const lines = diff.split('\n');
    let currentFile = 'unknown';
    let currentLine = 0;

    for (const rawLine of lines) {
      // Check for file header: +++ b/path/to/file
      if (rawLine.startsWith('+++ b/')) {
        currentFile = rawLine.substring(6).trim();
        continue;
      }

      // Check for hunk header: @@ -10,5 +15,7 @@
      const hunkMatch = rawLine.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunkMatch) {
        currentLine = parseInt(hunkMatch[1], 10) - 1;
        continue;
      }

      // Track line numbering for added lines
      if (rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
        currentLine += 1;
        const lineContent = rawLine.substring(1);

        // Check Secret Patterns
        for (const rule of SECRET_PATTERNS) {
          if (rule.regex.test(lineContent)) {
            issues.push({
              file: currentFile,
              line_start: currentLine,
              line_end: currentLine,
              severity: rule.severity,
              category: 'security',
              title: rule.title,
              description: rule.description,
              suggestion: rule.suggestion,
              confidence: 1.0,
              source: 'static-rule-engine',
            });
          }
        }

        // Check Anti-Patterns
        for (const rule of ANTI_PATTERNS) {
          if (rule.regex.test(lineContent)) {
            issues.push({
              file: currentFile,
              line_start: currentLine,
              line_end: currentLine,
              severity: rule.severity,
              category: rule.severity === 'CRITICAL' ? 'security' : 'code-quality',
              title: rule.title,
              description: rule.description,
              suggestion: rule.suggestion,
              confidence: 1.0,
              source: 'static-rule-engine',
            });
          }
        }
      } else if (!rawLine.startsWith('-')) {
        // Context line (unchanged)
        currentLine += 1;
      }
    }

    return issues;
  }
}

module.exports = { RuleChecker, SECRET_PATTERNS, ANTI_PATTERNS };
