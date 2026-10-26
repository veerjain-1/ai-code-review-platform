const test = require('node:test');
const assert = require('node:assert');
const { MultiProviderLLM } = require('./llm');

test('MultiProviderLLM - selects provider based on LLM_PROVIDER env', () => {
  process.env.LLM_PROVIDER = 'openai';
  const engine = new MultiProviderLLM();
  assert.strictEqual(engine.provider, 'openai');
  delete process.env.LLM_PROVIDER;
});

test('MultiProviderLLM - dispatches to OpenAI when configured', async (t) => {
  const originalFetch = global.fetch;
  process.env.OPENAI_API_KEY = 'test-key-123';
  process.env.LLM_PROVIDER = 'openai';

  t.after(() => {
    global.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_PROVIDER;
  });

  global.fetch = async (url, options) => {
    assert.ok(url.includes('api.openai.com'));
    assert.strictEqual(options.headers.Authorization, 'Bearer test-key-123');
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"summary": "OpenAI Review Completed", "score": 9}',
            },
          },
        ],
      }),
    };
  };

  const engine = new MultiProviderLLM();
  const output = await engine.generate([{ role: 'user', content: 'test diff' }]);
  assert.strictEqual(output, '{"summary": "OpenAI Review Completed", "score": 9}');
});

test('MultiProviderLLM - dispatches to Anthropic when configured', async (t) => {
  const originalFetch = global.fetch;
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  process.env.LLM_PROVIDER = 'anthropic';

  t.after(() => {
    global.fetch = originalFetch;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.LLM_PROVIDER;
  });

  global.fetch = async (url, options) => {
    assert.ok(url.includes('api.anthropic.com'));
    assert.strictEqual(options.headers['x-api-key'], 'test-anthropic-key');
    return {
      ok: true,
      json: async () => ({
        content: [{ text: '{"summary": "Anthropic Review Completed", "score": 8}' }],
      }),
    };
  };

  const engine = new MultiProviderLLM();
  const output = await engine.generate([{ role: 'user', content: 'test diff' }]);
  assert.strictEqual(output, '{"summary": "Anthropic Review Completed", "score": 8}');
});

test('MultiProviderLLM - throws informative error when API returns HTTP failure', async (t) => {
  const originalFetch = global.fetch;
  process.env.OPENAI_API_KEY = 'test-key-123';
  process.env.LLM_PROVIDER = 'openai';

  t.after(() => {
    global.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_PROVIDER;
  });

  global.fetch = async () => ({
    ok: false,
    status: 401,
    text: async () => 'Invalid API Key',
  });

  const engine = new MultiProviderLLM();
  // Override _generateLocal to avoid downloading ONNX during test
  engine._generateLocal = async () => '{"fallback": true}';

  const output = await engine.generate([{ role: 'user', content: 'test' }]);
  assert.strictEqual(output, '{"fallback": true}');
});
