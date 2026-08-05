const chalk = require('chalk');
const ora = require('ora');
const fetch = require('node-fetch');
const { loadConfig } = require('../utils/config');

/**
 * Status command — check the status of a submitted review.
 */
async function statusCommand(reviewId, options) {
  const config = loadConfig();
  const gatewayUrl = options.gateway || config.gateway_url || 'http://localhost:3000';

  if (!reviewId) {
    // List recent reviews
    console.log(chalk.cyan('📋 Fetching recent reviews...\n'));
    try {
      const response = await fetch(`${gatewayUrl}/api/v1/reviews?limit=10`);
      const data = await response.json();

      if (data.reviews && data.reviews.length > 0) {
        data.reviews.forEach((r) => {
          const statusColor = r.status === 'COMPLETED' ? chalk.green
            : r.status === 'FAILED' ? chalk.red
            : chalk.yellow;

          console.log(`  ${statusColor(r.status.padEnd(10))} ${chalk.gray(r.reviewId)} ${r.repo}/${r.branch}`);
        });
        console.log(chalk.gray(`\n  Total: ${data.total} reviews`));
      } else {
        console.log(chalk.yellow('  No reviews found.'));
      }
    } catch (err) {
      console.error(chalk.red(`❌ Cannot connect to gateway: ${err.message}`));
    }
    return;
  }

  // Get specific review status
  const poll = options.watch;
  const spinner = poll ? ora('Waiting for review to complete...').start() : null;

  const checkStatus = async () => {
    try {
      const response = await fetch(`${gatewayUrl}/api/v1/reviews/${reviewId}`);
      const data = await response.json();

      if (!response.ok) {
        if (spinner) spinner.stop();
        console.error(chalk.red(`❌ ${data.error}`));
        return true; // Stop polling
      }

      if (data.status === 'COMPLETED' || data.status === 'FAILED' || !poll) {
        if (spinner) spinner.stop();

        const statusColor = data.status === 'COMPLETED' ? chalk.green
          : data.status === 'FAILED' ? chalk.red
          : chalk.yellow;

        console.log(chalk.cyan.bold('\n═══ Review Status ═══'));
        console.log(`  ID:      ${data.reviewId}`);
        console.log(`  Status:  ${statusColor(data.status)}`);
        console.log(`  Repo:    ${data.repo}`);
        console.log(`  Branch:  ${data.branch}`);
        console.log(`  Created: ${data.createdAt}`);

        if (data.result) {
          console.log(`\n  Score:   ${data.result.score}/10`);
          console.log(`  Summary: ${data.result.summary}`);
          console.log(`  Issues:  ${data.result.issues?.length || 0}`);
        }

        return true; // Stop polling
      }

      return false; // Continue polling
    } catch (err) {
      if (spinner) spinner.stop();
      console.error(chalk.red(`❌ ${err.message}`));
      return true;
    }
  };

  if (poll) {
    let done = false;
    while (!done) {
      done = await checkStatus();
      if (!done) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  } else {
    await checkStatus();
  }
}

module.exports = { statusCommand };
