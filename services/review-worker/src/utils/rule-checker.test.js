const test = require('node:test');
const assert = require('node:assert');
const { RuleChecker } = require('./rule-checker');

test('RuleChecker - detects hardcoded AWS key in diff', () => {
  const diff = `--- a/config.js
+++ b/config.js
@@ -1,3 +1,4 @@
 const env = "production";
+const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";
 function init() {}
`;

  const issues = RuleChecker.scan(diff);
  assert.strictEqual(issues.length, 1);
  assert.strictEqual(issues[0].severity, 'CRITICAL');
  assert.strictEqual(issues[0].title, 'Hardcoded AWS Access Key ID Detected');
  assert.strictEqual(issues[0].file, 'config.js');
  assert.strictEqual(issues[0].line_start, 2);
});

test('RuleChecker - detects GitHub personal access token', () => {
  const diff = `--- a/client.js
+++ b/client.js
@@ -10,3 +10,4 @@
-const token = null;
+const token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
`;

  const issues = RuleChecker.scan(diff);
  assert.strictEqual(issues.length, 1);
  assert.strictEqual(issues[0].title, 'Hardcoded GitHub Personal Access Token');
  assert.strictEqual(issues[0].severity, 'CRITICAL');
});

test('RuleChecker - detects eval() and console.log usage', () => {
  const diff = `--- a/runner.js
+++ b/runner.js
@@ -5,4 +5,6 @@
 function execute(code) {
+  console.log("executing code:", code);
+  return eval(code);
 }
`;

  const issues = RuleChecker.scan(diff);
  assert.strictEqual(issues.length, 2);
  const titles = issues.map(i => i.title);
  assert.ok(titles.includes('Use of eval() Detected'));
  assert.ok(titles.includes('Production Logging Anti-Pattern (console.log)'));
});

test('RuleChecker - ignores deleted lines containing secrets', () => {
  const diff = `--- a/safe.js
+++ b/safe.js
@@ -1,3 +1,3 @@
-const oldKey = "AKIAIOSFODNN7EXAMPLE";
+const newKey = process.env.AWS_KEY;
`;

  const issues = RuleChecker.scan(diff);
  assert.strictEqual(issues.length, 0, 'Should not alert on deleted secret line');
});

test('RuleChecker - handles empty or non-string input safely', () => {
  assert.deepStrictEqual(RuleChecker.scan(''), []);
  assert.deepStrictEqual(RuleChecker.scan(null), []);
  assert.deepStrictEqual(RuleChecker.scan(undefined), []);
});
