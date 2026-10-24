const test = require('node:test');
const assert = require('node:assert');
const { PRFormatter } = require('./pr-formatter');

test('PRFormatter - formats review summary with badges and score', () => {
  const reviewResult = {
    score: 8,
    summary: 'Solid implementation with minor maintainability suggestions.',
    issues: [
      {
        severity: 'WARNING',
        category: 'performance',
        file: 'src/api.js',
        line_start: 42,
        title: 'Unindexed Database Query in Loop',
        description: 'Executing DB query inside forEach creates N+1 overhead.',
        suggestion: 'Use Promise.all or bulk query.'
      }
    ],
    highlights: ['Well-structured module boundaries.'],
    metadata: {
      files_reviewed: 3,
      total_additions: 45,
      total_deletions: 12,
      languages_detected: ['javascript']
    }
  };

  const md = PRFormatter.formatSummary(reviewResult);
  assert.ok(md.includes('## 🤖 AI Code Review & Security Analysis'));
  assert.ok(md.includes('8/10'));
  assert.ok(md.includes('Unindexed Database Query in Loop'));
  assert.ok(md.includes('src/api.js:42'));
  assert.ok(md.includes('Well-structured module boundaries.'));
  assert.ok(md.includes('Files: 3'));
});

test('PRFormatter - includes breaking changes section when present', () => {
  const reviewResult = {
    score: 4,
    summary: 'Breaking changes detected in public export contracts.',
    breaking_changes: [
      'Removed getUserById endpoint from /api/v1/users',
      'Changed auth token format from Bearer JWT to API Key'
    ],
    issues: []
  };

  const md = PRFormatter.formatSummary(reviewResult);
  assert.ok(md.includes('### 💥 Potential Breaking Changes'));
  assert.ok(md.includes('Removed getUserById endpoint'));
  assert.ok(md.includes('Changed auth token format'));
});

test('PRFormatter - formats single inline issue with suggestion', () => {
  const issue = {
    severity: 'CRITICAL',
    category: 'security',
    title: 'SQL Injection in Raw Query',
    description: 'User input directly concatenated into SQL statement.',
    suggestion: 'db.query("SELECT * FROM users WHERE id = ?", [userId])'
  };

  const inline = PRFormatter.formatSingleIssue(issue);
  assert.ok(inline.includes('🛑 CRITICAL [security]'));
  assert.ok(inline.includes('SQL Injection in Raw Query'));
  assert.ok(inline.includes('```suggestion'));
  assert.ok(inline.includes('db.query'));
});
