const { llm } = require('../utils/llm');
const { extractJson } = require('../utils/json');

const SYSTEM_PROMPT = `You are a Principal Software Architect Review Agent.
Your SOLE focus is identifying architectural regressions, breaking API contract changes, domain boundary leaks, and scalability bottlenecks.
Do NOT comment on minor code style, linting, or standard security vulnerabilities unless they affect the system architecture.

Key focus areas:
1. Breaking API Changes: removed/renamed public endpoints, altered payload contracts, dropped required parameters.
2. Architectural Layering: business logic leaking into presentation/controllers, database queries inside presentation components.
3. Scalability Anti-Patterns: unbounded in-memory collections, N+1 query loops, missing pagination on lists.
4. Resilience: lack of timeouts/circuit-breakers on cross-service HTTP calls, unhandled distributed failure modes.

You must output valid JSON matching this schema:
{
  "issues": [
    {
      "file": "<filename>",
      "line_start": <line number>,
      "line_end": <line number>,
      "severity": "CRITICAL | WARNING | INFO",
      "category": "architecture | breaking-change | scalability | resilience",
      "title": "Short descriptive title",
      "description": "Detailed explanation of the architectural concern",
      "suggestion": "Concrete architectural fix or backward-compatible alternative",
      "confidence": <number 0.0-1.0>
    }
  ],
  "breaking_changes": [
    "High-level description of any breaking change introduced in this PR"
  ]
}`;

class ArchitectureAgent {
  async run(state) {
    console.log('🏛️  Running Local Architecture & Breaking Change Agent...');
    try {
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { 
          role: 'user', 
          content: `Review the following git diff for ARCHITECTURAL regressions, BREAKING API CHANGES, and SCALABILITY issues.\n\n--- BEGIN DIFF ---\n${state.diff}\n--- END DIFF ---\n\nProvide your structured review as JSON:` 
        }
      ];

      const rawOutput = await llm.generate(messages);
      const result = extractJson(rawOutput);
      return { 
        architecture_issues: result.issues || [],
        breaking_changes: result.breaking_changes || []
      };
    } catch (err) {
      console.error('❌ Architecture Agent failed:', err.message);
      return { architecture_issues: [], breaking_changes: [] };
    }
  }
}

module.exports = { ArchitectureAgent };
