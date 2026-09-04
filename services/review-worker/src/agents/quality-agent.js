const { llm } = require('../utils/llm');
const { extractJson } = require('../utils/json');

const SYSTEM_PROMPT = `You are a highly specialized Code Quality & Performance Review Agent.
Your SOLE focus is identifying performance bottlenecks, unmaintainable code, bad architectural choices, and missing test coverage.
Do NOT comment on security vulnerabilities.

You must output valid JSON matching this schema:
{
  "issues": [
    {
      "file": "<filename>",
      "line_start": <line number>,
      "line_end": <line number>,
      "severity": "WARNING | INFO",
      "category": "performance | code-quality | best-practices | maintainability",
      "title": "Short descriptive title",
      "description": "Detailed explanation of the issue",
      "suggestion": "Concrete code fix",
      "confidence": <number 0.0-1.0>
    }
  ],
  "highlights": [
    "Positive observations about well-written code (optional)"
  ]
}`;

class QualityAgent {
  async run(state) {
    console.log('✨ Running Local Quality & Performance Agent...');
    try {
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Review the following git diff for QUALITY and PERFORMANCE issues only.\n\n--- BEGIN DIFF ---\n${state.diff}\n--- END DIFF ---\n\nProvide your structured quality review as JSON:` }
      ];

      const rawOutput = await llm.generate(messages);
      const result = extractJson(rawOutput);
      return { 
        quality_issues: result.issues || [],
        highlights: result.highlights || []
      };
    } catch (err) {
      console.error('❌ Quality Agent failed:', err.message);
      return { quality_issues: [], highlights: [] };
    }
  }
}

module.exports = { QualityAgent };
