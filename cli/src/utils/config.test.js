const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadConfig } = require('./config');

describe('loadConfig', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-review-cli-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns the built-in defaults when no .ai-review.yaml exists', () => {
    const config = loadConfig();

    assert.deepStrictEqual(config, {
      llm: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.2,
      },
      review: {
        categories: ['security', 'performance', 'code-quality', 'best-practices'],
        severity_threshold: 'WARNING',
      },
      gateway_url: 'http://localhost:3000',
    });
  });

  it('loads and parses a .ai-review.yaml in the current directory', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.ai-review.yaml'),
      'llm:\n  provider: anthropic\n  model: claude-opus\ngateway_url: https://gateway.example.com\n'
    );

    const config = loadConfig();

    assert.strictEqual(config.llm.provider, 'anthropic');
    assert.strictEqual(config.llm.model, 'claude-opus');
    assert.strictEqual(config.gateway_url, 'https://gateway.example.com');
  });

  it('walks up to an ancestor directory to find .ai-review.yaml', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.ai-review.yaml'),
      'gateway_url: https://parent.example.com\n'
    );
    const nested = path.join(tmpDir, 'nested', 'deeper');
    fs.mkdirSync(nested, { recursive: true });
    process.chdir(nested);

    const config = loadConfig();

    assert.strictEqual(config.gateway_url, 'https://parent.example.com');
  });

  it('falls back to defaults and warns when the yaml file is malformed', () => {
    fs.writeFileSync(path.join(tmpDir, '.ai-review.yaml'), ':\n  this is not: valid: yaml: at all\n');

    const originalWarn = console.warn;
    let warned = false;
    console.warn = () => {
      warned = true;
    };

    let config;
    try {
      config = loadConfig();
    } finally {
      console.warn = originalWarn;
    }

    assert.strictEqual(warned, true);
    assert.strictEqual(config.gateway_url, 'http://localhost:3000');
  });

  it('returns an empty object if the yaml file is empty', () => {
    fs.writeFileSync(path.join(tmpDir, '.ai-review.yaml'), '');

    const config = loadConfig();

    assert.deepStrictEqual(config, {});
  });
});
