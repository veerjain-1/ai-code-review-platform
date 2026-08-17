require('dotenv').config();

const { KafkaConsumer } = require('./kafka/consumer');
const { ReviewChain } = require('./chains/review-chain');
const { GithubPublisher } = require('./publishers/github');

async function main() {
  console.log('🤖 AI Review Worker starting...');
  console.log(`📡 LLM Provider: ${process.env.LLM_PROVIDER || 'openai'}`);
  console.log(`🧠 Model: ${process.env.LLM_MODEL || 'gpt-4o'}`);

  const reviewChain = new ReviewChain();
  const githubPublisher = new GithubPublisher();
  const consumer = new KafkaConsumer();

  // Register message handler
  consumer.onMessage(async (payload) => {
    const { reviewId, repo, branch, diff, pr_url, pr_number, commit_sha } = payload;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📋 Processing review: ${reviewId}`);
    console.log(`📂 Repo: ${repo} | Branch: ${branch}`);
    console.log(`${'─'.repeat(60)}`);

    try {
      // ─── Step 1: Run AI Review via LangChain ───
      console.log('🔍 Running AI code review...');
      const reviewResult = await reviewChain.review(diff, {
        repo,
        branch,
        commit_sha,
      });

      console.log(`✅ Review complete: ${reviewResult.issues.length} issues found`);
      console.log(`   Summary: ${reviewResult.summary}`);

      // ─── Step 2: Publish results to Kafka (for gate-check service) ───
      await consumer.publishResult({
        reviewId,
        repo,
        branch,
        pr_url,
        pr_number,
        commit_sha,
        status: 'COMPLETED',
        result: reviewResult,
        completedAt: new Date().toISOString(),
      });

      // ─── Step 3: Post to GitHub PR if applicable ───
      if (pr_url && pr_number && process.env.GITHUB_TOKEN) {
        console.log(`💬 Posting review to PR #${pr_number}...`);
        await githubPublisher.postReview(repo, pr_number, reviewResult, commit_sha);
        console.log(`✅ Review posted to GitHub PR #${pr_number}`);
      }

    } catch (err) {
      console.error(`❌ Review failed for ${reviewId}:`, err.message);

      await consumer.publishResult({
        reviewId,
        repo,
        branch,
        status: 'FAILED',
        error: err.message,
        failedAt: new Date().toISOString(),
      });
    }
  });

  // Start consuming
  await consumer.start();

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n🔻 ${signal} received. Shutting down worker...`);
    await consumer.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('❌ Worker crashed:', err);
  process.exit(1);
});
