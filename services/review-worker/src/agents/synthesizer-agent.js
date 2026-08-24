const { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } = require('@langchain/core/prompts');
const { JsonOutputParser } = require('@langchain/core/output_parsers');
const { createLLM } = require('../utils/llm');

const SYSTEM_PROMPT = `You are the Lead Synthesizer Agent for an AI Code Review platform.
You will receive a list of security issues and quality/performance issues found by specialized sub-agents.
Your job is to:
1. De-duplicate any overlapping issues (e.g. if the security agent and quality agent flagged the exact same line for similar reasons).
2. Write a concise 2-3 sentence executive summary of the overall code quality.
3. Calculate an objective score from 1-10 (10 is perfect) based on the severity and volume of the findings.
4. Extract basic metadata (languages detected, total files affected) from the findings and the diff.

You must output valid JSON matching this exact schema:
{
  "summary": "A 2-3 sentence executive summary",
  "score": <number 1-10>,
  "issues": [
    // Consolidated list of issues (must match the sub-agent schema)
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

const HUMAN_PROMPT = `Please synthesize the final review.

Repository: {repo}
Branch: {branch}

--- RAW SECURITY ISSUES ---
{security_issues}

--- RAW QUALITY ISSUES ---
{quality_issues}

--- HIGHLIGHTS ---
{highlights}

Provide the final structured JSON review:`;

class SynthesizerAgent {
  constructor() {
    this.llm = createLLM(0.1);
    this.parser = new JsonOutputParser();
    this.prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(SYSTEM_PROMPT),
      HumanMessagePromptTemplate.fromTemplate(HUMAN_PROMPT),
    ]);
    this.chain = this.prompt.pipe(this.llm).pipe(this.parser).withRetry({ stopAfterAttempt: 3 });
  }

  async run(state) {
    console.log('🧠 Running Lead Synthesizer Agent...');
    try {
      const result = await this.chain.invoke({
        repo: state.repo,
        branch: state.branch,
        security_issues: JSON.stringify(state.security_issues, null, 2),
        quality_issues: JSON.stringify(state.quality_issues, null, 2),
        highlights: JSON.stringify(state.highlights, null, 2),
      });

      return { final_review: result };
    } catch (err) {
      console.error('❌ Synthesizer Agent failed:', err.message);
      
      // Fallback: merge manually if synthesis fails
      return {
        final_review: {
          summary: 'Review completed with warnings. (Synthesis step failed to generate summary).',
          score: 5,
          issues: [...state.security_issues, ...state.quality_issues],
          highlights: state.highlights,
          metadata: { languages_detected: [] }
        }
      };
    }
  }
}

module.exports = { SynthesizerAgent };
