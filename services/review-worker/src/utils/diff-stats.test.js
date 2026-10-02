const { describe, it } = require('node:test');
const assert = require('node:assert');
const { computeDiffStats, detectLanguage } = require('./diff-stats');

describe('computeDiffStats', () => {
  it('returns zeroed stats for an empty or missing diff', () => {
    assert.deepStrictEqual(computeDiffStats(''), {
      filesReviewed: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      languagesDetected: [],
    });
    assert.deepStrictEqual(computeDiffStats(null), {
      filesReviewed: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      languagesDetected: [],
    });
    assert.deepStrictEqual(computeDiffStats(undefined), {
      filesReviewed: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      languagesDetected: [],
    });
  });

  it('counts files, additions, and deletions for a single-file diff', () => {
    const diff = [
      'diff --git a/src/index.js b/src/index.js',
      'index 1234567..89abcde 100644',
      '--- a/src/index.js',
      '+++ b/src/index.js',
      '@@ -1,3 +1,4 @@',
      ' function hello() {',
      '-  console.log("hi");',
      '+  console.log("hello");',
      '+  console.log("world");',
      ' }',
    ].join('\n');

    const stats = computeDiffStats(diff);
    assert.strictEqual(stats.filesReviewed, 1);
    assert.strictEqual(stats.totalAdditions, 2);
    assert.strictEqual(stats.totalDeletions, 1);
    assert.deepStrictEqual(stats.languagesDetected, ['JavaScript']);
  });

  it('counts multiple files and multiple languages', () => {
    const diff = [
      'diff --git a/app.py b/app.py',
      '--- a/app.py',
      '+++ b/app.py',
      '@@ -1,1 +1,2 @@',
      '+print("hi")',
      'diff --git a/main.go b/main.go',
      '--- a/main.go',
      '+++ b/main.go',
      '@@ -1,1 +1,2 @@',
      '+fmt.Println("hi")',
    ].join('\n');

    const stats = computeDiffStats(diff);
    assert.strictEqual(stats.filesReviewed, 2);
    assert.strictEqual(stats.totalAdditions, 2);
    assert.strictEqual(stats.totalDeletions, 0);
    assert.deepStrictEqual(stats.languagesDetected, ['Go', 'Python']);
  });

  it('handles a newly added file (old path is /dev/null)', () => {
    const diff = [
      'diff --git a/new-file.ts b/new-file.ts',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/new-file.ts',
      '@@ -0,0 +1,2 @@',
      '+export const x = 1;',
      '+export const y = 2;',
    ].join('\n');

    const stats = computeDiffStats(diff);
    assert.strictEqual(stats.filesReviewed, 1);
    assert.strictEqual(stats.totalAdditions, 2);
    assert.deepStrictEqual(stats.languagesDetected, ['TypeScript']);
  });

  it('handles a deleted file (new path is /dev/null) and still detects its language', () => {
    const diff = [
      'diff --git a/old-script.rb b/old-script.rb',
      'deleted file mode 100644',
      '--- a/old-script.rb',
      '+++ /dev/null',
      '@@ -1,2 +0,0 @@',
      '-puts "hi"',
      '-puts "bye"',
    ].join('\n');

    const stats = computeDiffStats(diff);
    assert.strictEqual(stats.filesReviewed, 0);
    assert.strictEqual(stats.totalDeletions, 2);
    assert.deepStrictEqual(stats.languagesDetected, ['Ruby']);
  });

  it('does not miscount diff header lines (---/+++) as content additions/deletions', () => {
    const diff = [
      'diff --git a/a.js b/a.js',
      '--- a/a.js',
      '+++ b/a.js',
      '@@ -1,1 +1,1 @@',
      '-old',
      '+new',
    ].join('\n');

    const stats = computeDiffStats(diff);
    assert.strictEqual(stats.totalAdditions, 1);
    assert.strictEqual(stats.totalDeletions, 1);
  });

  it('deduplicates and sorts detected languages', () => {
    const diff = [
      'diff --git a/b.ts b/b.ts',
      '--- a/b.ts',
      '+++ b/b.ts',
      '+x',
      'diff --git a/c.tsx b/c.tsx',
      '--- a/c.tsx',
      '+++ b/c.tsx',
      '+y',
      'diff --git a/d.py b/d.py',
      '--- a/d.py',
      '+++ b/d.py',
      '+z',
    ].join('\n');

    const stats = computeDiffStats(diff);
    assert.deepStrictEqual(stats.languagesDetected, ['Python', 'TypeScript']);
  });
});

describe('detectLanguage', () => {
  it('maps common extensions to their language', () => {
    assert.strictEqual(detectLanguage('src/app.py'), 'Python');
    assert.strictEqual(detectLanguage('src/app.tsx'), 'TypeScript');
    assert.strictEqual(detectLanguage('Main.java'), 'Java');
    assert.strictEqual(detectLanguage('lib.rs'), 'Rust');
  });

  it('returns null for unknown or missing extensions', () => {
    assert.strictEqual(detectLanguage('Makefile'), null);
    assert.strictEqual(detectLanguage('README'), null);
    assert.strictEqual(detectLanguage('weird.xyzabc'), null);
  });
});
