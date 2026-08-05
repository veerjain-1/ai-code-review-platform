const { execSync } = require('child_process');
const chalk = require('chalk');
const ora = require('ora');
const fetch = require('node-fetch');
const Table = require('cli-table3');
const { loadConfig } = require('../utils/config');

/**
 * Review command — captures git diff and sends it for AI review.
 */
async function reviewCommand(options) {
  const config = loadConfig();
  const gatewayUrl = options.gateway || config.gateway_url || 'http://localhost:3000';

  let diff = '';
  let branch = '';
  let commitSha = '';

  try {
    // ─── Determine what to review ───
    if (options.staged) {
      console.log(chalk.cyan('📋 Reviewing staged changes...'));
      diff = execSync('git diff --cached', { encoding: 'utf-8' });
      branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    } else if (options.commit) {
      console.log(chalk.cyan(`📋 Reviewing commit: ${options.commit}`));
      diff = execSync(`git show ${options.commit} --format=""`, { encoding: 'utf-8' });
      commitSha = options.commit;
      branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    } else if (options.branch) {
      const targetBranch = options.branch;
      console.log(chalk.cyan(`📋 Reviewing diff against branch: ${targetBranch}`));
      diff = execSync(`git diff ${targetBranch}...HEAD`, { encoding: 'utf-8' });
      branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    } else if (options.file) {
      console.log(chalk.cyan(`📋 Reviewing file: ${options.file}`));
      diff = execSync(`git diff HEAD -- ${options.file}`, { encoding: 'utf-8' });
      if (!diff) {
        diff = execSync(`git diff -- ${options.file}`, { encoding: 'utf-8' });
      }
      branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    } else if (options.pr) {
      console.log(chalk.cyan(`📋 Reviewing PR: ${options.pr}`));
      // For PR review, send the URL and let the worker fetch the diff
      diff = '__PR_URL__';
    } else {
      // Default: review uncommitted changes
      console.log(chalk.cyan('📋 Reviewing uncommitted changes...'));
      diff = execSync('git diff', { encoding: 'utf-8' });
      branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    }

    if (!diff || diff.trim().length === 0) {
      console.log(chalk.yellow('\n⚠️  No changes detected. Nothing to review.'));
      console.log(chalk.gray('   Try: ai-review review --staged'));
      console.log(chalk.gray('   Try: ai-review review --commit HEAD~1'));
      return;
    }

    // Get repo name
    let repo = 'local';
    try {
      const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
      const match = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
      if (match) repo = match[1];
    } catch (_) {
      // No remote, use local
    }

    // ─── Local mode: use LangChain directly ───
    if (options.local) {
      console.log(chalk.yellow('\n🏠 Local review mode — running LangChain directly...'));
      // Dynamically import the review chain from review-worker
      try {
        const { ReviewChain } = require('../../services/review-worker/src/chains/review-chain');
        const chain = new ReviewChain();
        const spinner = ora('Running AI review...').start();
        const result = await chain.review(diff, { repo, branch, commit_sha: commitSha });
        spinner.stop();
        displayResult(result, options.output);
      } catch (err) {
        console.error(chalk.red('\n❌ Local review failed. Make sure your API key is set.'));
        console.error(chalk.gray(`   Error: ${err.message}`));
        console.log(chalk.gray('\n   Set your API key:'));
        console.log(chalk.gray('   export OPENAI_API_KEY=sk-...'));
      }
      return;
    }

    // ─── Gateway mode: send to API ───
    const spinner = ora('Submitting review request...').start();

    const response = await fetch(`${gatewayUrl}/api/v1/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo,
        branch,
        diff: diff === '__PR_URL__' ? null : diff,
        pr_url: options.pr || null,
        commit_sha: commitSha || null,
      }),
    });

    const data = await response.json();
    spinner.stop();

    if (response.ok) {
      console.log(chalk.green(`\n✅ Review submitted successfully!`));
      console.log(chalk.white(`   Review ID: ${chalk.bold(data.reviewId)}`));
      console.log(chalk.gray(`   Status: ${data.status}`));
      console.log(chalk.gray(`\n   Check status: ai-review status ${data.reviewId}`));
      console.log(chalk.gray(`   Watch: ai-review status ${data.reviewId} --watch`));
    } else {
      console.error(chalk.red(`\n❌ Failed to submit review: ${data.error}`));
    }

  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.error(chalk.red('\n❌ Cannot connect to the gateway.'));
      console.error(chalk.gray(`   Make sure the gateway is running at ${gatewayUrl}`));
      console.error(chalk.gray('   Start it: cd services/gateway && npm run dev'));
    } else {
      console.error(chalk.red(`\n❌ Review failed: ${err.message}`));
    }
  }
}

/**
 * Display the review result in the specified format.
 */
function displayResult(result, format) {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (format === 'markdown') {
    console.log(formatMarkdown(result));
    return;
  }

  // Default: table format
  const scoreColor = result.score >= 7 ? chalk.green : result.score >= 4 ? chalk.yellow : chalk.red;
  const scoreBar = '█'.repeat(result.score) + '░'.repeat(10 - result.score);

  console.log('\n' + chalk.cyan.bold('═══ AI Code Review Results ═══'));
  console.log(`\nScore: ${scoreColor(`[${scoreBar}] ${result.score}/10`)}`);
  console.log(`Summary: ${result.summary}\n`);

  if (result.issues.length > 0) {
    const table = new Table({
      head: [
        chalk.white.bold('Severity'),
        chalk.white.bold('File'),
        chalk.white.bold('Line'),
        chalk.white.bold('Issue'),
        chalk.white.bold('Category'),
      ],
      colWidths: [12, 25, 8, 40, 16],
      wordWrap: true,
    });

    const severityColor = {
      CRITICAL: chalk.red.bold,
      WARNING: chalk.yellow,
      INFO: chalk.blue,
    };

    result.issues.forEach((issue) => {
      const colorFn = severityColor[issue.severity] || chalk.white;
      table.push([
        colorFn(issue.severity),
        issue.file,
        `${issue.line_start}`,
        issue.title,
        issue.category,
      ]);
    });

    console.log(table.toString());

    // Show detailed suggestions for CRITICAL issues
    const criticals = result.issues.filter((i) => i.severity === 'CRITICAL');
    if (criticals.length > 0) {
      console.log(chalk.red.bold('\n🔴 Critical Issues (Details):'));
      criticals.forEach((issue, idx) => {
        console.log(chalk.red(`\n${idx + 1}. ${issue.title}`));
        console.log(chalk.gray(`   File: ${issue.file}:${issue.line_start}`));
        console.log(`   ${issue.description}`);
        if (issue.suggestion) {
          console.log(chalk.green(`   💡 Fix: ${issue.suggestion}`));
        }
      });
    }
  } else {
    console.log(chalk.green('✅ No issues found! Great code.'));
  }

  if (result.highlights && result.highlights.length > 0) {
    console.log(chalk.cyan.bold('\n🌟 Highlights:'));
    result.highlights.forEach((h) => console.log(chalk.green(`   ✓ ${h}`)));
  }

  console.log('');
}

/**
 * Format result as markdown.
 */
function formatMarkdown(result) {
  let md = `## AI Code Review\n\n`;
  md += `**Score:** ${result.score}/10\n\n`;
  md += `**Summary:** ${result.summary}\n\n`;

  if (result.issues.length > 0) {
    md += `### Issues (${result.issues.length})\n\n`;
    md += `| Severity | File | Line | Issue | Category |\n`;
    md += `|----------|------|------|-------|----------|\n`;
    result.issues.forEach((i) => {
      md += `| ${i.severity} | ${i.file} | ${i.line_start} | ${i.title} | ${i.category} |\n`;
    });
  }

  return md;
}

module.exports = { reviewCommand };
