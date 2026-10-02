/**
 * Parses a unified git diff and computes real review metadata --
 * files touched, lines added/removed, and languages detected from
 * file extensions -- instead of leaving these fields hardcoded to
 * zero/empty in the final review payload.
 */

const EXTENSION_LANGUAGE_MAP = {
  js: 'JavaScript',
  jsx: 'JavaScript',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  ts: 'TypeScript',
  tsx: 'TypeScript',
  py: 'Python',
  java: 'Java',
  go: 'Go',
  rs: 'Rust',
  rb: 'Ruby',
  php: 'PHP',
  c: 'C',
  h: 'C',
  cpp: 'C++',
  cc: 'C++',
  hpp: 'C++',
  cs: 'C#',
  kt: 'Kotlin',
  kts: 'Kotlin',
  swift: 'Swift',
  scala: 'Scala',
  sh: 'Shell',
  bash: 'Shell',
  sql: 'SQL',
  yml: 'YAML',
  yaml: 'YAML',
  json: 'JSON',
  md: 'Markdown',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
};

/**
 * Extracts the file path from a unified diff's `+++ b/<path>` header line.
 * Returns null for /dev/null (deleted files have no "new" path).
 */
function parseNewFilePath(line) {
  const match = line.match(/^\+\+\+ (?:b\/)?(.+)$/);
  if (!match) return null;
  const path = match[1].trim();
  return path === '/dev/null' ? null : path;
}

/**
 * Extracts the file path from a unified diff's `--- a/<path>` header line.
 * Returns null for /dev/null (new files have no "old" path).
 */
function parseOldFilePath(line) {
  const match = line.match(/^--- (?:a\/)?(.+)$/);
  if (!match) return null;
  const path = match[1].trim();
  return path === '/dev/null' ? null : path;
}

function detectLanguage(filePath) {
  const extMatch = filePath.match(/\.([^./]+)$/);
  if (!extMatch) return null;
  return EXTENSION_LANGUAGE_MAP[extMatch[1].toLowerCase()] || null;
}

/**
 * Computes diff statistics from a unified git diff string.
 *
 * @param {string} diff - The raw unified diff text.
 * @returns {{filesReviewed: number, totalAdditions: number, totalDeletions: number, languagesDetected: string[]}}
 */
function computeDiffStats(diff) {
  const stats = {
    filesReviewed: 0,
    totalAdditions: 0,
    totalDeletions: 0,
    languagesDetected: [],
  };

  if (!diff || typeof diff !== 'string') {
    return stats;
  }

  const languages = new Set();
  const filesSeen = new Set();
  const lines = diff.split('\n');

  for (const line of lines) {
    if (line.startsWith('+++')) {
      const path = parseNewFilePath(line);
      if (path) {
        filesSeen.add(path);
        const lang = detectLanguage(path);
        if (lang) languages.add(lang);
      }
      continue;
    }

    if (line.startsWith('---')) {
      const path = parseOldFilePath(line);
      // Only use the old path for language detection (deleted files);
      // the file-count is driven by the new-path side above, and a
      // rename/modify will already have been counted via +++.
      if (path && !filesSeen.has(path)) {
        const lang = detectLanguage(path);
        if (lang) languages.add(lang);
      }
      continue;
    }

    // Content lines: a leading '+' or '-' not part of a '+++'/'---' header.
    if (line.startsWith('+') && !line.startsWith('+++')) {
      stats.totalAdditions += 1;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      stats.totalDeletions += 1;
    }
  }

  stats.filesReviewed = filesSeen.size;
  stats.languagesDetected = Array.from(languages).sort();

  return stats;
}

module.exports = { computeDiffStats, detectLanguage };
