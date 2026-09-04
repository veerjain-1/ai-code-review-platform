const { llm } = require('../utils/llm');
const { extractJson } = require('../utils/json');

const SYSTEM_PROMPT = `You are a highly specialized Security Code Review Agent.
Your SOLE focus is identifying security vulnerabilities, data leaks, and insecure coding practices (e.g., OWASP Top 10).
Do NOT comment on code style, performance, or testing unless it directly impacts security.

Your review MUST be actionable, specific, and constructive.
You must output valid JSON matching this schema:
{
  "issues": [
    {
      "file": "<filename>",
      "line_start": <line number>,
      "line_end": <line number>,
      "severity": "CRITICAL | WARNING",
      "category": "security",
      "title": "Short descriptive title",
      "description": "Detailed explanation of the vulnerability",
      "suggestion": "Concrete code fix",
      "confidence": <number 0.0-1.0>
    }
  ]
}`;

class SecurityAgent {
  async run(state) {
    console.log('🛡️  Running Local Security Agent...');
    try {
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Review the following git diff for SECURITY issues only.\n\n--- BEGIN DIFF ---\n${state.diff}\n--- END DIFF ---\n\nProvide your structured security review as JSON:` }
      ];

      const rawOutput = await llm.generate(messages);
      const result = extractJson(rawOutput);
      return { security_issues: result.issues || [] };
    } catch (err) {
      console.error('❌ Security Agent failed:', err.message);
      return { security_issues: [] };
    }
  }
}

module.exports = { SecurityAgent };
