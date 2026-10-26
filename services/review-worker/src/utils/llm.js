/**
 * Multi-Provider LLM Inference Engine for AI Code Review Platform.
 * Supports OpenAI, Anthropic, Google Gemini, and Local ONNX inference
 * with graceful fallback.
 */

class MultiProviderLLM {
  constructor() {
    this.provider = (process.env.LLM_PROVIDER || 'local').toLowerCase();
    this.modelName = process.env.LLM_MODEL || process.env.MODEL_NAME;
    this.localEngine = null;
  }

  /**
   * Main text generation entrypoint.
   * @param {Array<{role: string, content: string}>} messages
   * @returns {Promise<string>}
   */
  async generate(messages) {
    if (this.provider === 'openai' || process.env.OPENAI_API_KEY) {
      try {
        return await this._generateOpenAI(messages);
      } catch (err) {
        console.warn(`⚠️ OpenAI inference failed (${err.message}). Falling back to local ONNX...`);
      }
    }

    if (this.provider === 'anthropic' || process.env.ANTHROPIC_API_KEY) {
      try {
        return await this._generateAnthropic(messages);
      } catch (err) {
        console.warn(`⚠️ Anthropic inference failed (${err.message}). Falling back to local ONNX...`);
      }
    }

    if (this.provider === 'gemini' || process.env.GEMINI_API_KEY) {
      try {
        return await this._generateGemini(messages);
      } catch (err) {
        console.warn(`⚠️ Gemini inference failed (${err.message}). Falling back to local ONNX...`);
      }
    }

    return await this._generateLocal(messages);
  }

  // ─── OpenAI Provider ───
  async _generateOpenAI(messages) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is not set');

    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = this.modelName || 'gpt-4o';

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI HTTP ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    return data.choices[0]?.message?.content?.trim() || '{}';
  }

  // ─── Anthropic Provider ───
  async _generateAnthropic(messages) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set');

    const model = this.modelName || 'claude-3-5-sonnet-20241022';
    const systemMsg = messages.find(m => m.role === 'system')?.content || '';
    const userMsgs = messages.filter(m => m.role !== 'system');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: systemMsg,
        messages: userMsgs,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Anthropic HTTP ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    return data.content[0]?.text?.trim() || '{}';
  }

  // ─── Google Gemini Provider ───
  async _generateGemini(messages) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');

    const model = this.modelName || 'gemini-1.5-flash';
    const contents = messages.map(m => ({
      role: m.role === 'system' || m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gemini HTTP ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
  }

  // ─── Local ONNX Inference Engine ───
  async _generateLocal(messages) {
    if (!this.localEngine) {
      const { pipeline, env } = require('@xenova/transformers');
      env.allowLocalModels = false;
      env.useBrowserCache = false;

      const model = this.modelName || 'Xenova/Qwen1.5-0.5B-Chat';
      console.log(`\n⏳ Initializing local ONNX model: ${model}`);
      this.localEngine = await pipeline('text-generation', model);
      console.log('✅ Local model loaded successfully');
    }

    let prompt = '';
    for (const msg of messages) {
      prompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
    }
    prompt += '<|im_start|>assistant\n';

    const result = await this.localEngine(prompt, {
      max_new_tokens: 1024,
      temperature: 0.1,
      do_sample: true,
      return_full_text: false,
    });

    return result[0].generated_text.trim();
  }
}

const llm = new MultiProviderLLM();
module.exports = { llm, MultiProviderLLM };
