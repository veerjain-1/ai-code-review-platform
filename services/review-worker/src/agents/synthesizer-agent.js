const { llm } = require('../utils/llm');
const { extractJson } = require('../utils/json');

const SYSTEM_PROMPT = `You are the Lead Synthesizer Agent for an AI Code Review platform.
You will receive a list of security issues and quality/performance issues found by specialized sub-agents.
Your job is to:
1. De-duplicate any overlapping issues.
2. Write a concise 2-3 sentence executive summary of the overall code quality.
3. Calculate an objective score from 1-10 (10 is perfect).
4. Extract basic metadata.

You must output valid JSON matching this exact schema:
{
  "summary": "A 2-3 sentence executive summary",
  "score": <number 1-10>,
  "issues": [
    {
      "file": "...",
      "line_start": 0,
      "line_end": 0,
      "severity": "CRITICAL | WARNING | INFO",
      "category": "security | performance | code-quality | best-practices | maintainability",
      "title": "...",
      "description": "...",
      "suggestion": "...",
      "confidence": 0.9
    }
  ],
  "highlights": [ "..." ],
  "metadata": {
    "languages_detected": ["<language>"]
  }
}`;

class SynthesizerAgent {
  async run(state) {
    console.log('🧠 Running Local Synthesizer Agent...');
    try {
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { 
          role: 'user', 
          content: `Please synthesize the final review.\n\nRepository: ${state.repo}\nBranch: ${state.branch}\n\n--- RAW SECURITY ISSUES ---\n${JSON.stringify(state.security_issues, null, 2)}\n\n--- RAW QUALITY ISSUES ---\n${JSON.stringify(state.quality_issues, null, 2)}\n\n--- HIGHLIGHTS ---\n${JSON.stringify(state.highlights, null, 2)}\n\nProvide the final structured JSON review:` 
        }
      ];

      const rawOutput = await llm.generate(messages);
      const result = extractJson(rawOutput);
      return { final_review: result };
    } catch (err) {
      console.error('❌ Synthesizer Agent failed:', err.message);
      
      // Fallback: merge manually if synthesis fails
      return {
        final_review: {
          summary: 'Review completed with warnings. (Synthesis step failed to generate summary).',
          score: 5,
          issues: [...(state.security_issues || []), ...(state.quality_issues || [])],
          highlights: state.highlights || [],
          metadata: { languages_detected: [] }
        }
      };
    }
  }
}

module.exports = { SynthesizerAgent };
