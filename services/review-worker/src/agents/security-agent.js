const { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } = require('@langchain/core/prompts');
const { JsonOutputParser } = require('@langchain/core/output_parsers');
const { createLLM } = require('../utils/llm');

const SYSTEM_PROMPT = `You are a highly specialized Security Code Review Agent.
Your SOLE focus is identifying security vulnerabilities, data leaks, and insecure coding practices (e.g., OWASP Top 10).
Do NOT comment on code style, performance, or testing unless it directly impacts security.

Your review MUST be actionable, specific, and constructive. For each issue:
- Identify the exact file and line range affected
- Classify the severity accurately (CRITICAL or WARNING)
- Provide a concrete fix or improvement suggestion
- Explain the security risk

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

const HUMAN_PROMPT = `Review the following git diff for SECURITY issues only.

--- BEGIN DIFF ---
{diff}
--- END DIFF ---

Provide your structured security review as JSON:`;

class SecurityAgent {
  constructor() {
    this.llm = createLLM(0.1); // Lower temperature for security analysis
    this.parser = new JsonOutputParser();
    this.prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(SYSTEM_PROMPT),
      HumanMessagePromptTemplate.fromTemplate(HUMAN_PROMPT),
    ]);
    this.chain = this.prompt.pipe(this.llm).pipe(this.parser).withRetry({ stopAfterAttempt: 3 });
  }

  async run(state) {
    console.log('🛡️  Running Security Agent...');
    try {
      const result = await this.chain.invoke({ diff: state.diff });
      return { security_issues: result.issues || [] };
    } catch (err) {
      console.error('❌ Security Agent failed:', err.message);
      return { security_issues: [] };
    }
  }
}

module.exports = { SecurityAgent };
