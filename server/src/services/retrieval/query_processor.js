/**
 * QueryProcessor
 * Normalizes queries, extracts stack traces, error types, file references, and line numbers.
 */

export class QueryProcessor {
  /**
   * Parses the raw query to identify explicit signals.
   * @param {string} rawQuery
   */
  static process(rawQuery) {
    if (!rawQuery || typeof rawQuery !== 'string') {
      return {
        originalQuery: '',
        normalizedText: '',
        errorTypes: [],
        fileHints: [],
        lineHints: [],
        stackFrames: [],
        symbolHints: []
      };
    }

    const trimmed = rawQuery.trim();

    // 1. Detect error types (TypeError, ReferenceError, SyntaxError, NullPointerException, etc.)
    const errorTypeRegex = /\b([A-Z][a-zA-Z]*(?:Error|Exception|Fault|Warning))\b/g;
    const errorTypes = Array.from(new Set(Array.from(trimmed.matchAll(errorTypeRegex), m => m[1])));

    // 2. Detect stack trace frames like:
    // "at EmployeeList.jsx:27" or "at Object.handleSearch (EmployeeList.jsx:27:12)"
    // "File "main.py", line 42, in query_users"
    const stackFrames = [];
    const fileHints = new Set();
    const lineHints = new Set();
    const symbolHints = new Set();

    // JS/TS stack frame: at (function)? (path/file.ext):(line):?(col)?
    const jsStackRegex = /(?:at\s+(?:([A-Za-z0-9_$.<>]+)\s+\()?)?(?:[A-Za-z0-9_./\\-]+\/)?([A-Za-z0-9_-]+\.[a-zA-Z0-9]+):(\d+)(?::(\d+))?\)?/g;
    for (const match of trimmed.matchAll(jsStackRegex)) {
      const func = match[1] || null;
      const file = match[2];
      const line = parseInt(match[3], 10);
      if (file && !isNaN(line)) {
        stackFrames.push({ file, line, function: func });
        fileHints.add(file);
        lineHints.add(line);
        if (func) symbolHints.add(func);
      }
    }

    // Python stack frame: File "foo.py", line 12, in bar
    const pyStackRegex = /File\s+["'](?:.*[/\\])?([A-Za-z0-9_-]+\.[a-zA-Z0-9]+)["'],\s+line\s+(\d+)(?:,\s+in\s+([A-Za-z0-9_]+))?/g;
    for (const match of trimmed.matchAll(pyStackRegex)) {
      const file = match[1];
      const line = parseInt(match[2], 10);
      const func = match[3] || null;
      stackFrames.push({ file, line, function: func });
      fileHints.add(file);
      lineHints.add(line);
      if (func) symbolHints.add(func);
    }

    // 3. Generic file mention in text (e.g. "EmployeeList.jsx has a bug around line 27")
    const genericFileRegex = /\b([A-Za-z0-9_-]+\.(?:jsx?|tsx?|py|java|cpp|c|go|rs|json|md))\b/g;
    for (const match of trimmed.matchAll(genericFileRegex)) {
      fileHints.add(match[1]);
    }

    // Generic line mention: "line 27", "lines 24-31"
    const lineMentionRegex = /\blines?\s+(\d+)(?:\s*(?:-|to)\s*(\d+))?\b/gi;
    for (const match of trimmed.matchAll(lineMentionRegex)) {
      const l1 = parseInt(match[1], 10);
      lineHints.add(l1);
      if (match[2]) {
        lineHints.add(parseInt(match[2], 10));
      }
    }

    // 4. Normalized search text (cleaned for semantic embedding while retaining key identifiers)
    const normalizedText = trimmed
      .replace(/\r?\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      originalQuery: trimmed,
      normalizedText,
      errorTypes,
      fileHints: Array.from(fileHints),
      lineHints: Array.from(lineHints),
      stackFrames,
      symbolHints: Array.from(symbolHints)
    };
  }
}
