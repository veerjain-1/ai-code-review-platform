/**
 * Resilient JSON extractor and repair engine for LLM outputs.
 * Parses strict JSON, handles markdown code fences, and repairs
 * truncated JSON structures caused by token-limit cutoffs.
 */

/**
 * Attempts to repair truncated JSON by closing unclosed strings,
 * stripping trailing commas, and closing unclosed arrays and objects.
 * @param {string} str - Malformed or truncated JSON candidate
 * @returns {string} Repaired JSON candidate
 */
function repairJson(str) {
  if (!str || typeof str !== 'string') return '{}';

  let cleaned = str.trim();
  const startIdx = cleaned.indexOf('{');
  if (startIdx === -1) return '{}';
  cleaned = cleaned.substring(startIdx);

  // 1. Close unclosed strings by scanning quotes (respecting backslash escapes)
  let inString = false;
  let isEscaped = false;
  const stack = [];

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (char === '\\') {
      isEscaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}') {
        if (stack.length > 0 && stack[stack.length - 1] === '{') {
          stack.pop();
        }
      } else if (char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === '[') {
          stack.pop();
        }
      }
    }
  }

  // If stopped inside a string, close it
  if (inString) {
    cleaned += '"';
  }

  // 2. Remove trailing commas or incomplete key:value pairs at cutoff point
  cleaned = cleaned.replace(/,\s*$/, '');
  cleaned = cleaned.replace(/:\s*$/, ': null');

  // 3. Close open brackets and braces in LIFO order
  while (stack.length > 0) {
    const openToken = stack.pop();
    if (openToken === '{') {
      cleaned = cleaned.replace(/,\s*$/, '');
      cleaned += '}';
    } else if (openToken === '[') {
      cleaned = cleaned.replace(/,\s*$/, '');
      cleaned += ']';
    }
  }

  return cleaned;
}

/**
 * Extracts and parses a JSON object from text that may contain markdown blocks,
 * leading/trailing conversational text, or truncated tokens.
 * @param {string} text - Raw model response
 * @returns {Object} Parsed JSON object
 */
function extractJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Input text is empty or not a string');
  }

  // 1. Direct parse attempt
  try {
    return JSON.parse(text);
  } catch (_e1) {
    // Continue
  }

  // 2. Markdown code block extraction (```json ... ```)
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (_e2) {
      try {
        return JSON.parse(repairJson(codeBlockMatch[1]));
      } catch (_e3) {
        // Continue
      }
    }
  }

  // 3. Balanced substring boundary search
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(text.substring(start, end + 1));
    } catch (_e4) {
      // Continue
    }
  }

  // 4. Token truncation repair fallback
  if (start !== -1) {
    try {
      const repaired = repairJson(text.substring(start));
      return JSON.parse(repaired);
    } catch (_e5) {
      // Continue
    }
  }

  throw new Error('Failed to extract valid JSON from LLM output');
}

module.exports = { extractJson, repairJson };
