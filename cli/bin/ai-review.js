#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const { reviewCommand } = require('../src/commands/review');
const { statusCommand } = require('../src/commands/status');
const { initCommand } = require('../src/commands/init');
const { installHooksCommand } = require('../src/commands/install-hooks');

const banner = `
${chalk.cyan.bold('╔═══════════════════════════════════════════╗')}
${chalk.cyan.bold('║')}  ${chalk.white.bold('🔍 AI Code Review CLI')}                    ${chalk.cyan.bold('║')}
${chalk.cyan.bold('║')}  ${chalk.gray('Automated AI-powered code reviews')}        ${chalk.cyan.bold('║')}
${chalk.cyan.bold('╚═══════════════════════════════════════════╝')}
`;

program
  .name('ai-review')
  .description('AI-powered code review CLI tool')
  .version('1.0.0')
  .addHelpText('before', banner);

// ─── review command ───
program
  .command('review')
  .description('Submit code for AI review')
  .option('-s, --staged', 'Review staged changes (git diff --cached)')
  .option('-c, --commit <sha>', 'Review a specific commit')
  .option('-b, --branch <name>', 'Review diff against a branch (default: main)')
  .option('--pr <url>', 'Review a GitHub Pull Request by URL')
  .option('--file <path>', 'Review a specific file')
  .option('--local', 'Run review locally without sending to gateway (requires API key)')
  .option('--gateway <url>', 'Gateway URL (default: http://localhost:3000)')
  .option('-o, --output <format>', 'Output format: table | json | markdown', 'table')
  .action(reviewCommand);

// ─── status command ───
program
  .command('status [reviewId]')
  .description('Check the status of a submitted review')
  .option('--gateway <url>', 'Gateway URL (default: http://localhost:3000)')
  .option('--watch', 'Poll for updates until complete')
  .action(statusCommand);

// ─── init command ───
program
  .command('init')
  .description('Initialize AI review configuration in the current project')
  .action(initCommand);

// ─── install-hooks command ───
program
  .command('install-hooks')
  .description('Install Git hooks for automatic code review')
  .option('--hook <type>', 'Hook type: pre-push | pre-commit', 'pre-push')
  .action(installHooksCommand);

program.parse();
