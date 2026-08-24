const { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } = require('@langchain/core/prompts');
const { JsonOutputParser } = require('@langchain/core/output_parsers');
const { createLLM } = require('../utils/llm');

const SYSTEM_PROMPT = `You are a highly specialized Code Quality & Performance Review Agent.
Your SOLE focus is identifying performance bottlenecks, unmaintainable code, bad architectural choices, and missing test coverage.
Do NOT comment on security vulnerabilities.

Your review MUST be actionable, specific, and constructive. For each issue:
- Identify the exact file and line range affected
- Classify the severity accurately (WARNING or INFO)
- Provide a concrete fix or improvement suggestion

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
    "Positive observations about well-written code or clever optimizations (optional)"
  ]
}`;

const HUMAN_PROMPT = `Review the following git diff for QUALITY and PERFORMANCE issues only.

--- BEGIN DIFF ---
{diff}
--- END DIFF ---

Provide your structured quality review as JSON:`;

class QualityAgent {
  constructor() {
    this.llm = createLLM(0.3);
    this.parser = new JsonOutputParser();
    this.prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(SYSTEM_PROMPT),
      HumanMessagePromptTemplate.fromTemplate(HUMAN_PROMPT),
    ]);
    this.chain = this.prompt.pipe(this.llm).pipe(this.parser).withRetry({ stopAfterAttempt: 3 });
  }

  async run(state) {
    console.log('✨ Running Quality & Performance Agent...');
    try {
      const result = await this.chain.invoke({ diff: state.diff });
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
