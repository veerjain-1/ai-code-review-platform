const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');

const DEFAULT_CONFIG = {
  llm: {
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.2,
  },
  review: {
    categories: ['security', 'performance', 'code-quality', 'best-practices'],
    severity_threshold: 'WARNING',
  },
  gate_checks: {
    max_critical_issues: 0,
    max_warnings: 5,
    require_tests: true,
  },
  gateway_url: 'http://localhost:3000',
};

/**
 * Init command — create .ai-review.yaml config in the project root.
 */
async function initCommand() {
  const configPath = path.join(process.cwd(), '.ai-review.yaml');

  if (fs.existsSync(configPath)) {
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: '.ai-review.yaml already exists. Overwrite?',
      default: false,
    }]);

    if (!overwrite) {
      console.log(chalk.yellow('Aborted.'));
      return;
    }
  }

  // Interactive setup
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Select your LLM provider:',
      choices: ['openai', 'anthropic', 'google'],
      default: 'openai',
    },
    {
      type: 'input',
      name: 'model',
      message: 'Model name:',
      default: (ans) => {
        const defaults = { openai: 'gpt-4o', anthropic: 'claude-sonnet-4-20250514', google: 'gemini-pro' };
        return defaults[ans.provider] || 'gpt-4o';
      },
    },
    {
      type: 'input',
      name: 'gateway_url',
      message: 'Gateway URL:',
      default: 'http://localhost:3000',
    },
    {
      type: 'checkbox',
      name: 'categories',
      message: 'Review categories:',
      choices: ['security', 'performance', 'code-quality', 'best-practices', 'bug', 'maintainability'],
      default: ['security', 'performance', 'code-quality', 'best-practices'],
    },
  ]);

  const yaml = require('yaml');
  const config = {
    ...DEFAULT_CONFIG,
    llm: { ...DEFAULT_CONFIG.llm, provider: answers.provider, model: answers.model },
    review: { ...DEFAULT_CONFIG.review, categories: answers.categories },
    gateway_url: answers.gateway_url,
  };

  fs.writeFileSync(configPath, yaml.stringify(config), 'utf-8');
  console.log(chalk.green(`\n✅ Created ${configPath}`));
  console.log(chalk.gray('   Edit this file to customize your review settings.'));
  console.log(chalk.gray('\n   Next: ai-review install-hooks'));
}

module.exports = { initCommand };
