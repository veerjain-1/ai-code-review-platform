const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
let calls = [], missingRecord;
const ids = Array.from({ length: 100 }, (_, i) => String(i));
const client = {
  on() { return this; }, async connect() {},
  async lRange(key, start, stop) {
    calls.push(['lRange', key, start, stop]);
    return ids.slice(start, stop < 0 ? ids.length + stop + 1 : stop + 1);
  },
  async mGet(keys) { calls.push(['mGet', keys]); return keys.map(k => k === missingRecord ? null : JSON.stringify({ reviewId: k.slice(7) })); },
  async lLen(key) { calls.push(['lLen', key]); return 100; },
};
// Exercise the actual router over HTTP; replace only the external boundaries.
const boundaries = [[require.resolve('redis'), { createClient: () => client }],
  [require.resolve('../kafka/producer'), { publishReviewRequest: async () => {} }]];
const saved = boundaries.map(([path]) => require.cache[path]);
let router;
try {
  boundaries.forEach(([path, exports]) => { require.cache[path] = { id: path, filename: path, loaded: true, exports }; });
  router = require('./reviews');
} finally {
  boundaries.forEach(([path], i) => { if (saved[i]) require.cache[path] = saved[i]; else delete require.cache[path]; });
}
describe('review-list limit validation', () => {
  let server;
  beforeEach(async () => {
    calls = []; missingRecord = undefined;
    const app = express(); app.use('/api/v1/reviews', router);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  });
  afterEach(async () => new Promise(resolve => server.close(resolve)));
  function request(query) {
    return new Promise((resolve, reject) => {
      const req = http.get({ host: '127.0.0.1', port: server.address().port,
        path: '/api/v1/reviews' + query, headers: { connection: 'close' } }, res => {
        let body = ''; res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      });
      req.on('error', reject); req.setTimeout(3000, () => req.destroy(new Error('HTTP fixture timed out')));
    });
  }
  for (const [query, limit] of [['', 20], ['?limit=1', 1], ['?limit=2', 2], ['?limit=100', 100], ['?limit=101', 100], ['?limit=9007199254740991', 100], ['?limit=002', 2]]) {
    it(`preserves pagination for ${query || 'omitted limit'}`, async () => {
      const r = await request(query); assert.equal(r.status, 200);
      assert.equal(r.body.count, limit); assert.equal(r.body.total, 100);
      assert.deepEqual(r.body.reviews.map(x => x.reviewId), ids.slice(0, limit));
      assert.deepEqual(calls[0], ['lRange', 'recent_reviews', 0, limit - 1]);
    });
  }
  for (const value of ['-1', '0', '2abc', '2.5', '', ' ', '+2', '1e2', '0x10', 'NaN', 'Infinity', '9007199254740992', '9'.repeat(400)]) {
    it(`rejects scalar ${value.slice(0, 25)} before Redis reads`, async () => {
      const r = await request('?limit=' + encodeURIComponent(value));
      assert.equal(r.status, 400); assert.match(r.body.error, /positive safe integer/); assert.deepEqual(calls, []);
    });
  }
  for (const query of ['?limit=1&limit=2', '?limit[]=2', '?limit[value]=2']) {
    it(`rejects non-scalar ${query} before Redis reads`, async () => { assert.equal((await request(query)).status, 400); assert.deepEqual(calls, []); });
  }
  it('preserves total when a record is missing', async () => {
    missingRecord = 'review:1'; const r = await request('?limit=2');
    assert.equal(r.status, 200); assert.equal(r.body.total, 100); assert.equal(r.body.count, 1);
    assert.deepEqual(r.body.reviews, [{ reviewId: '0' }]);
  });
});
