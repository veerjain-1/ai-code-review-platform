const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const express = require('express');
const { parseWebhookBody } = require('../webhooks/body');

// Keep the actual router, substituting only the Kafka publishing boundary.
const producerPath = require.resolve('../kafka/producer');
const savedProducer = require.cache[producerPath];
let published = [];
require.cache[producerPath] = {
  id: producerPath, filename: producerPath, loaded: true,
  exports: { publishReviewRequest: async (request) => published.push(request) },
};
const router = require('./webhooks');
if (savedProducer) require.cache[producerPath] = savedProducer;
else delete require.cache[producerPath];

const secret = 'local-webhook-test-secret';
const payload = JSON.stringify({
  action: 'opened', repository: { full_name: 'fixture/repo' },
  pull_request: {
    number: 42, html_url: 'https://github.com/fixture/repo/pull/42',
    head: { ref: 'feature', sha: 'head-sha' }, base: { sha: 'base-sha' },
    user: { login: 'fixture' }, title: 'Fixture', additions: 1, deletions: 0, changed_files: 1,
  },
}, null, 2) + '\n';
const sign = (body, key = secret) => 'sha256=' + crypto.createHmac('sha256', key).update(body).digest('hex');

describe('GitHub webhook signatures', () => {
  let server, previousSecret;
  beforeEach(async () => {
    previousSecret = process.env.GITHUB_WEBHOOK_SECRET;
    process.env.GITHUB_WEBHOOK_SECRET = secret;
    published = [];
    const app = express();
    app.use('/api/v1/webhooks', parseWebhookBody);
    app.use(express.json({ limit: '10mb' }));
    app.use('/api/v1/webhooks', router);
    app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  });
  afterEach(async () => {
    if (previousSecret === undefined) delete process.env.GITHUB_WEBHOOK_SECRET;
    else process.env.GITHUB_WEBHOOK_SECRET = previousSecret;
    await new Promise((resolve) => server.close(resolve));
  });

  function request(body, signature, { event = 'pull_request', chunked = false } = {}) {
    return new Promise((resolve, reject) => {
      const headers = { 'content-type': 'application/json', 'x-github-event': event, connection: 'close' };
      if (!chunked) headers['content-length'] = Buffer.byteLength(body);
      if (signature !== undefined) headers['x-hub-signature-256'] = signature;
      const req = http.request({ host: '127.0.0.1', port: server.address().port, path: '/api/v1/webhooks/github', method: 'POST', headers }, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      });
      req.on('error', reject);
      req.setTimeout(3000, () => req.destroy(new Error('HTTP fixture timed out')));
      if (chunked) { req.write(body.slice(0, 13)); req.end(body.slice(13)); }
      else req.end(body);
    });
  }

  it('accepts a valid signature over whitespace-preserving raw bytes', async () => {
    const response = await request(payload, sign(payload));
    assert.equal(response.status, 202);
    assert.equal(published.length, 1);
    assert.equal(published[0].repo, 'fixture/repo');
    assert.equal(published[0].pr_number, 42);
  });
  it('accepts signed UTF-8 payload bytes', async () => {
    const body = payload.replace('Fixture', 'Fixture 🧪é');
    assert.equal((await request(body, sign(body))).status, 202);
    assert.equal(published.length, 1);
  });
  it('accepts signed chunked requests without a content length', async () => {
    assert.equal((await request(payload, sign(payload), { chunked: true })).status, 202);
    assert.equal(published.length, 1);
  });
  for (const [name, signature] of [
    ['missing', undefined], ['empty', ''], ['truncated', 'sha256=abc'],
    ['non-hex', 'sha256=' + 'g'.repeat(64)], ['wrong algorithm', 'sha1=' + 'a'.repeat(40)],
    ['wrong secret', sign(payload, 'different-secret')],
  ]) {
    it(`rejects ${name} signatures without publishing`, async () => {
      assert.equal((await request(payload, signature)).status, 401);
      assert.equal(published.length, 0);
    });
  }
  it('rejects a signature for a different byte representation of the same JSON', async () => {
    const compact = JSON.stringify(JSON.parse(payload));
    assert.equal((await request(payload, sign(compact))).status, 401);
    assert.equal(published.length, 0);
  });
  it('rejects body tampering after signing', async () => {
    assert.equal((await request(payload.replace('Fixture', 'Tampered'), sign(payload))).status, 401);
    assert.equal(published.length, 0);
  });
  it('verifies signatures on ignored event types as well', async () => {
    assert.equal((await request('{}', undefined, { event: 'ping' })).status, 401);
    assert.equal((await request('{}', sign('{}'), { event: 'ping' })).status, 200);
    assert.equal(published.length, 0);
  });
  it('retains unsigned development mode when no secret is configured', async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    assert.equal((await request(payload)).status, 202);
    assert.equal(published.length, 1);
  });
});
