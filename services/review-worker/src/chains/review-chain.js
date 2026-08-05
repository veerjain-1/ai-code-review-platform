const { ChatOpenAI } = require('@langchain/openai');
const { ChatAnthropic } = require('@langchain/anthropic');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } = require('@langchain/core/prompts');
const { JsonOutputParser } = require('@langchain/core/output_parsers');

const SYSTEM_PROMPT = `You are an expert senior software engineer performing a thorough code review.
You have deep expertise in security, performance optimization, code quality, and software architecture.

Your review MUST be actionable, specific, and constructive. For each issue:
- Identify the exact file and line range affected
- Classify the severity accurately
- Provide a concrete fix or improvement suggestion
- Explain WHY it matters (security risk, performance impact, maintainability concern)

You must output valid JSON matching this exact schema:
{
  "summary": "A 2-3 sentence executive summary of the overall code quality",
  "score": <number 1-10, where 10 is perfect>,
  "issues": [
    {
      "file": "<filename from the diff>",
      "line_start": <line number>,
      "line_end": <line number>,
      "severity": "CRITICAL | WARNING | INFO",
      "category": "security | performance | code-quality | best-practices | bug | maintainability",
      "title": "Short descriptive title",
      "description": "Detailed explanation of the issue",
      "suggestion": "Concrete code fix or improvement",
      "confidence": <number 0.0-1.0>
    }
  ],
  "highlights": [
    "Positive observations about well-written code"
  ],
  "metadata": {
    "files_reviewed": <number>,
    "total_additions": <number>,
    "total_deletions": <number>,
    "languages_detected": ["<language>"]
  }
}

Severity Guidelines:
- CRITICAL: Security vulnerabilities, data loss risks, crash-causing bugs, broken functionality
- WARNING: Performance issues, code smells, missing error handling, potential bugs
- INFO: Style improvements, refactoring suggestions, documentation gaps`;

const HUMAN_PROMPT = `Review the following git diff carefully.

Repository: {repo}
Branch: {branch}
Commit: {commit_sha}

--- BEGIN DIFF ---
{diff}
--- END DIFF ---

Provide your structured code review as JSON:`;

class ReviewChain {
  constructor() {
    this.llm = this._createLLM();
    this.parser = new JsonOutputParser();
    this.prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(SYSTEM_PROMPT),
      HumanMessagePromptTemplate.fromTemplate(HUMAN_PROMPT),
    ]);

    // Build the chain: prompt -> LLM -> JSON parser
    this.chain = this.prompt.pipe(this.llm).pipe(this.parser);
  }

  /**
   * Create the LLM instance based on the configured provider.
   */
  _createLLM() {
    const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
    const temperature = parseFloat(process.env.LLM_TEMPERATURE) || 0.2;
    const maxTokens = parseInt(process.env.LLM_MAX_TOKENS) || 4096;

    switch (provider) {
      case 'anthropic':
        return new ChatAnthropic({
          modelName: process.env.LLM_MODEL || 'claude-sonnet-4-20250514',
          temperature,
          maxTokens,
          anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        });

      case 'google':
        return new ChatGoogleGenerativeAI({
          modelName: process.env.LLM_MODEL || 'gemini-pro',
          temperature,
          maxOutputTokens: maxTokens,
          apiKey: process.env.GOOGLE_API_KEY,
        });

      case 'openai':
      default:
        return new ChatOpenAI({
          modelName: process.env.LLM_MODEL || 'gpt-4o',
          temperature,
          maxTokens,
          openAIApiKey: process.env.OPENAI_API_KEY,
        });
    }
  }

  /**
   * Run a code review on the given diff.
   * @param {string} diff - The git diff to review
   * @param {Object} context - Additional context (repo, branch, commit_sha)
   * @returns {Object} - Structured review result
   */
  async review(diff, context = {}) {
    // Truncate extremely large diffs to avoid token limits
    const maxDiffLength = 50000;
    const truncatedDiff = diff.length > maxDiffLength
      ? diff.substring(0, maxDiffLength) + '\n\n[... diff truncated due to size ...]'
      : diff;

    const startTime = Date.now();

    try {
      const result = await this.chain.invoke({
        diff: truncatedDiff,
        repo: context.repo || 'unknown',
        branch: context.branch || 'unknown',
        commit_sha: context.commit_sha || 'unknown',
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`⏱️  LLM review completed in ${elapsed}s`);

      // Validate and normalize the result
      return this._normalizeResult(result);
    } catch (err) {
      console.error('❌ LangChain review failed:', err.message);

      // Return a fallback result on LLM failure
      return {
        summary: `Review failed: ${err.message}`,
        score: 0,
        issues: [],
        highlights: [],
        metadata: {
          files_reviewed: 0,
          total_additions: 0,
          total_deletions: 0,
          languages_detected: [],
          error: err.message,
        },
      };
    }
  }

  /**
   * Normalize and validate the LLM output.
   */
  _normalizeResult(result) {
    return {
      summary: result.summary || 'No summary provided.',
      score: Math.max(1, Math.min(10, result.score || 5)),
      issues: (result.issues || []).map((issue) => ({
        file: issue.file || 'unknown',
        line_start: issue.line_start || 0,
        line_end: issue.line_end || issue.line_start || 0,
        severity: ['CRITICAL', 'WARNING', 'INFO'].includes(issue.severity)
          ? issue.severity
          : 'INFO',
        category: issue.category || 'code-quality',
        title: issue.title || 'Untitled issue',
        description: issue.description || '',
        suggestion: issue.suggestion || '',
        confidence: Math.max(0, Math.min(1, issue.confidence || 0.5)),
      })),
      highlights: result.highlights || [],
      metadata: {
        files_reviewed: result.metadata?.files_reviewed || 0,
        total_additions: result.metadata?.total_additions || 0,
        total_deletions: result.metadata?.total_deletions || 0,
        languages_detected: result.metadata?.languages_detected || [],
      },
    };
  }
}

module.exports = { ReviewChain };
