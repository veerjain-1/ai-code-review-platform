const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

/**
 * Load the .ai-review.yaml config from the current project or ancestors.
 * Falls back to defaults if not found.
 */
function loadConfig() {
  let dir = process.cwd();

  while (dir !== path.dirname(dir)) {
    const configPath = path.join(dir, '.ai-review.yaml');
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        return yaml.parse(content) || {};
      } catch (err) {
        console.warn(`Warning: Failed to parse ${configPath}: ${err.message}`);
      }
    }
    dir = path.dirname(dir);
  }

  // Default config
  return {
    llm: {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.2,
    },
    review: {
      categories: ['security', 'performance', 'code-quality', 'best-practices'],
      severity_threshold: 'WARNING',
    },
    gateway_url: 'http://localhost:3000',
  };
}

module.exports = { loadConfig };
