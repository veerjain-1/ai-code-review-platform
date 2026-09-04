/**
 * Extracts and parses a JSON object from a string that might contain markdown blocks or leading/trailing text.
 */
function extractJson(text) {
  try {
    // Try direct parsing first
    return JSON.parse(text);
  } catch (e) {
    // Attempt to extract JSON from markdown code blocks
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1]);
      } catch (e2) {
        // Fallback
      }
    }
    
    // Attempt to find the first '{' and last '}'
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.substring(start, end + 1));
      } catch (e3) {
        // Fallback
      }
    }
    
    throw new Error('Failed to extract valid JSON from LLM output');
  }
}

module.exports = { extractJson };
