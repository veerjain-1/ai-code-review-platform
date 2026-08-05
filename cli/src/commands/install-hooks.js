const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const PRE_PUSH_HOOK = `#!/bin/sh
# AI Code Review — Pre-Push Hook
# Automatically submits code for AI review before pushing

echo "🔍 AI Code Review: Analyzing changes before push..."

# Get the diff of commits being pushed
DIFF=$(git diff @{push}..HEAD 2>/dev/null || git diff HEAD~1..HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
REPO=$(git remote get-url origin 2>/dev/null | sed -E 's/.*github\\.com[:\\/](.+?)(\\.git)?$/\\1/')

if [ -z "$DIFF" ]; then
  echo "✅ No changes to review."
  exit 0
fi

# Check if gateway is running
GATEWAY_URL=\${AI_REVIEW_GATEWAY:-http://localhost:3000}

if command -v ai-review &> /dev/null; then
  # Use CLI if available
  ai-review review --staged
else
  # Fallback to curl
  RESPONSE=$(curl -s -X POST "$GATEWAY_URL/api/v1/reviews" \\
    -H "Content-Type: application/json" \\
    -d "$(jq -n --arg repo "$REPO" --arg branch "$BRANCH" --arg diff "$DIFF" \\
      '{repo: $repo, branch: $branch, diff: $diff}')" 2>/dev/null)

  if [ $? -eq 0 ] && [ -n "$RESPONSE" ]; then
    REVIEW_ID=$(echo "$RESPONSE" | jq -r '.reviewId // empty')
    if [ -n "$REVIEW_ID" ]; then
      echo "📋 Review submitted: $REVIEW_ID"
      echo "   Check status: ai-review status $REVIEW_ID"
    fi
  else
    echo "⚠️  AI Review gateway not reachable. Skipping review."
  fi
fi

# Always allow the push (non-blocking)
exit 0
`;

const PRE_COMMIT_HOOK = `#!/bin/sh
# AI Code Review — Pre-Commit Hook
# Reviews staged changes before committing

echo "🔍 AI Code Review: Checking staged changes..."

DIFF=$(git diff --cached)

if [ -z "$DIFF" ]; then
  exit 0
fi

if command -v ai-review &> /dev/null; then
  ai-review review --staged --local 2>/dev/null
fi

# Always allow the commit (non-blocking)
exit 0
`;

/**
 * Install Git hooks for automatic code review.
 */
async function installHooksCommand(options) {
  const hookType = options.hook || 'pre-push';
  
  // Find the git root
  let gitDir;
  try {
    const { execSync } = require('child_process');
    gitDir = execSync('git rev-parse --git-dir', { encoding: 'utf-8' }).trim();
  } catch (err) {
    console.error(chalk.red('❌ Not a git repository. Run this command inside a git repo.'));
    return;
  }

  const hooksDir = path.join(gitDir, 'hooks');
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const hookPath = path.join(hooksDir, hookType);
  const hookContent = hookType === 'pre-commit' ? PRE_COMMIT_HOOK : PRE_PUSH_HOOK;

  // Check if hook already exists
  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, 'utf-8');
    if (existing.includes('AI Code Review')) {
      console.log(chalk.yellow(`⚠️  ${hookType} hook already installed.`));
      return;
    }
    // Append to existing hook
    fs.appendFileSync(hookPath, '\n' + hookContent);
    console.log(chalk.green(`✅ AI review appended to existing ${hookType} hook.`));
  } else {
    fs.writeFileSync(hookPath, hookContent);
    console.log(chalk.green(`✅ ${hookType} hook installed.`));
  }

  // Make executable
  fs.chmodSync(hookPath, '755');

  console.log(chalk.gray(`   Location: ${hookPath}`));
  console.log(chalk.gray(`   Hook type: ${hookType}`));
  console.log(chalk.gray(`\n   Your code will be automatically reviewed on ${hookType === 'pre-push' ? 'push' : 'commit'}.`));
}

module.exports = { installHooksCommand };
