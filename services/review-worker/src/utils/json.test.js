const test = require('node:test');
const assert = require('node:assert');
const { extractJson, repairJson } = require('./json');

test('extractJson - parses clean strict JSON', () => {
  const input = '{"summary": "All good", "score": 9}';
  const result = extractJson(input);
  assert.strictEqual(result.summary, 'All good');
  assert.strictEqual(result.score, 9);
});

test('extractJson - extracts JSON from markdown code fence', () => {
  const input = 'Here is the review result:\n```json\n{"summary": "Clean code", "issues": []}\n```\nHope this helps!';
  const result = extractJson(input);
  assert.strictEqual(result.summary, 'Clean code');
  assert.deepStrictEqual(result.issues, []);
});

test('extractJson - repairs and parses truncated JSON missing closing brackets', () => {
  // Truncated at end: missing ] and }
  const truncated = '{"summary": "Truncated review", "issues": [{"file": "app.js", "line_start": 10';
  const result = extractJson(truncated);
  assert.strictEqual(result.summary, 'Truncated review');
  assert.strictEqual(result.issues[0].file, 'app.js');
  assert.strictEqual(result.issues[0].line_start, 10);
});

test('extractJson - repairs truncated string inside array', () => {
  const truncated = '{"summary": "Unfinished string", "highlights": ["Good modularity';
  const result = extractJson(truncated);
  assert.strictEqual(result.summary, 'Unfinished string');
  assert.ok(result.highlights[0].startsWith('Good modularity'));
});

test('repairJson - handles empty input safely', () => {
  assert.strictEqual(repairJson(''), '{}');
  assert.strictEqual(repairJson(null), '{}');
  assert.strictEqual(repairJson('no json here'), '{}');
});
