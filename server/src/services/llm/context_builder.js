/**
 * ContextBuilder
 * Prepares compact, structured prompt context with explicit source delimitations.
 */

export class ContextBuilder {
  /**
   * Constructs system prompt with strict hallucination control.
   */
  static buildSystemPrompt() {
    return `You are CodeLens, a professional local RAG-powered debugging assistant.
Your job is to analyze the provided retrieved code evidence and pinpoint the exact bug causing the user's issue.

CRITICAL RULES:
1. You are analyzing ONLY the uploaded source files and retrieved evidence provided below.
2. Do NOT assume code exists outside the provided context.
3. NEVER invent or hallucinate filenames, line numbers, functions, variables, dependencies, or implementation details that do not exist in the retrieved evidence.
4. If the retrieved evidence is insufficient, unrelated, or does not clearly explain the bug, you MUST return "status": "INSUFFICIENT_EVIDENCE".
5. Every primary diagnosis MUST be directly supported by the retrieved evidence.
6. Distinguish clearly between:
   - Primary location (the exact file and lines where the bug originates)
   - Related locations (calls, interfaces, or dependent code that triggers or propagates it)
7. You must respond with valid JSON matching the schema below and NOTHING ELSE (no markdown fences, no preamble).

JSON SCHEMA:
{
  "status": "FOUND" | "INSUFFICIENT_EVIDENCE",
  "diagnosis": "Short summary of the bug",
  "errorType": "logic_error" | "state_management" | "null_access" | "race_condition" | "type_mismatch" | "off_by_one" | "api_mismatch" | "other",
  "confidence": 0.0 to 1.0,
  "primaryLocation": {
    "file": "exact filename from evidence",
    "startLine": number,
    "endLine": number
  },
  "explanation": "Detailed explanation of why this location causes the bug based solely on provided evidence",
  "evidence": [
    {
      "file": "filename",
      "startLine": number,
      "endLine": number,
      "reason": "Why this chunk is relevant evidence"
    }
  ],
  "relatedLocations": [
    {
      "file": "filename",
      "startLine": number,
      "endLine": number,
      "reason": "Relationship to the bug"
    }
  ],
  "suggestedFix": {
    "description": "Explanation of fix",
    "code": "Replacement or corrected code snippet"
  }
}`;
  }

  /**
   * Constructs user prompt with query and delimited code evidence.
   */
  static buildUserPrompt(query, retrievedChunks) {
    let prompt = `DEBUGGING QUERY / ERROR MESSAGE:\n${query}\n\n`;

    if (!retrievedChunks || retrievedChunks.length === 0) {
      prompt += `RETRIEVED CODE EVIDENCE:\nNone found.\n`;
      return prompt;
    }

    prompt += `RETRIEVED CODE EVIDENCE (${retrievedChunks.length} chunks):\n\n`;

    retrievedChunks.forEach((item, idx) => {
      const c = item.chunk;
      prompt += `==================================================\n`;
      prompt += `--- CHUNK #${idx + 1} (Score: ${item.similarity}) ---\n`;
      prompt += `--- FILE: ${c.file} ---\n`;
      prompt += `--- SYMBOL: ${c.symbol} (Type: ${c.type}) ---\n`;
      prompt += `--- LINES: ${c.startLine}-${c.endLine} ---\n`;
      prompt += `<code>\n${c.content}\n</code>\n\n`;
    });

    prompt += `Analyze the evidence above. Respond ONLY with valid JSON conforming to the specified schema.`;
    return prompt;
  }
}
