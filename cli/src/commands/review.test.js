const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { reviewCommand } = require('./review');

describe('reviewCommand Git inputs', () => {
  let directory, previousCwd, server, gateway, requests, errors;
  let originalLog, originalError;

  function git(...args) {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  }

  beforeEach(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-review-git-'));
    previousCwd = process.cwd();
    process.chdir(directory);
    git('init', '-b', 'main');
    git('config', 'user.name', 'CLI Test');
    git('config', 'user.email', 'cli-test@example.invalid');
    git('config', 'commit.gpgsign', 'false');
    git('remote', 'add', 'origin', 'https://github.com/example/project.git');
    fs.writeFileSync('normal.js', 'before\n');
    git('add', '.');
    git('commit', '-m', 'Initial fixture');
    requests = [];
    errors = [];
    originalLog = console.log;
    originalError = console.error;
    console.log = () => {};
    console.error = (...args) => errors.push(args.join(' '));
    server = http.createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      requests.push(JSON.parse(body));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reviewId: 'fixture', status: 'queued' }));
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    gateway = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    console.log = originalLog;
    console.error = originalError;
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    process.chdir(previousCwd);
    fs.rmSync(directory, { recursive: true, force: true });
  });

  async function review(options = {}) {
    await reviewCommand({ gateway, ...options });
  }

  it('submits the default uncommitted diff with repository metadata', async () => {
    fs.writeFileSync('normal.js', 'default change\n');
    await review();
    assert.equal(requests.length, 1);
    assert.match(requests[0].diff, /\+default change/);
    assert.equal(requests[0].repo, 'example/project');
    assert.equal(requests[0].branch, 'main');
  });

  it('reviews staged changes without including unstaged edits', async () => {
    fs.writeFileSync('normal.js', 'staged change\n');
    git('add', 'normal.js');
    fs.writeFileSync('normal.js', 'unstaged change\n');
    await review({ staged: true });
    assert.equal(requests.length, 1);
    assert.match(requests[0].diff, /\+staged change/);
    assert.doesNotMatch(requests[0].diff, /unstaged change/);
  });

  for (const file of ['file with spaces.js', 'notes;touch unwanted.txt', 'a[1].js', '-leading.js']) {
    it(`reviews the literal filename ${JSON.stringify(file)}`, async () => {
      fs.writeFileSync(file, 'before\n');
      fs.writeFileSync('a1.js', 'before\n');
      git('add', '.');
      git('commit', '-m', 'Add named fixtures');
      fs.writeFileSync(file, 'selected change\n');
      fs.writeFileSync('a1.js', 'unrelated change\n');
      await review({ file });
      assert.equal(fs.existsSync('unwanted.txt'), false);
      assert.equal(requests.length, 1);
      assert.match(requests[0].diff, /\+selected change/);
      assert.doesNotMatch(requests[0].diff, /unrelated change/);
    });
  }

  it('reviews a commit ref containing shell punctuation', async () => {
    fs.writeFileSync('normal.js', 'committed change\n');
    git('commit', '-am', 'Change fixture');
    git('tag', 'review;literal');
    await review({ commit: 'review;literal' });
    assert.equal(requests.length, 1);
    assert.match(requests[0].diff, /\+committed change/);
    assert.equal(requests[0].commit_sha, 'review;literal');
  });

  it('compares against a branch containing shell punctuation', async () => {
    git('branch', 'base;literal');
    fs.writeFileSync('normal.js', 'branch change\n');
    git('commit', '-am', 'Change fixture');
    await review({ branch: 'base;literal' });
    assert.equal(requests.length, 1);
    assert.match(requests[0].diff, /\+branch change/);
  });

  for (const option of ['commit', 'branch']) {
    it(`rejects an option-like ${option} without submitting a review`, async () => {
      await review({ [option]: '--output=unwanted.txt' });
      assert.equal(fs.existsSync('unwanted.txt'), false);
      assert.equal(requests.length, 0);
      assert.equal(errors.length, 1);
      assert.match(errors[0], /Review failed/);
    });
  }

  it('does not submit when there are no changes', async () => {
    await review();
    assert.equal(requests.length, 0);
    assert.deepEqual(errors, []);
  });

  it('submits a PR URL without requesting a local diff', async () => {
    await review({ pr: 'https://github.com/example/project/pull/1' });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].diff, null);
    assert.equal(requests[0].pr_url, 'https://github.com/example/project/pull/1');
  });
});
