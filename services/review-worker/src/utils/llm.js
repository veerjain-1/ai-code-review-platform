const { ChatOpenAI } = require('@langchain/openai');
const { ChatAnthropic } = require('@langchain/anthropic');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');

/**
 * Create the LLM instance based on the configured provider.
 */
function createLLM(overrideTemperature = null) {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
  const temperature = overrideTemperature !== null ? overrideTemperature : (parseFloat(process.env.LLM_TEMPERATURE) || 0.2);
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

module.exports = { createLLM };
