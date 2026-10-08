import * as babelParser from '@babel/parser';
import _traverse from '@babel/traverse';
import path from 'path';

// Handle ES module default export compatibility for @babel/traverse
const traverse = _traverse.default || _traverse;

/**
 * CodeChunk model:
 * {
 *   file: string,
 *   symbol: string,
 *   type: 'function' | 'react_component' | 'class' | 'method' | 'imports' | 'type_definition' | 'block' | 'fallback',
 *   startLine: number, // 1-indexed
 *   endLine: number,   // 1-indexed
 *   content: string
 * }
 */

/**
 * Chunks JavaScript, JSX, TypeScript, TSX using Babel AST parser.
 */
function chunkWithBabel(fileName, content) {
  const lines = content.split('\n');
  const chunks = [];
  const coveredLines = new Set();

  let ast;
  try {
    ast = babelParser.parse(content, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'decorators-legacy',
        'asyncGenerators',
        'dynamicImport',
        'exportDefaultFrom'
      ],
      errorRecovery: true
    });
  } catch (err) {
    // If AST parsing fails due to syntax or non-standard syntax, fallback gracefully
    return chunkGeneric(fileName, content);
  }

  // 1. Collect top-level imports as a context chunk if present
  let firstImportLine = null;
  let lastImportLine = null;

  traverse(ast, {
    ImportDeclaration(nodePath) {
      if (nodePath.node.loc) {
        if (firstImportLine === null) firstImportLine = nodePath.node.loc.start.line;
        lastImportLine = nodePath.node.loc.end.line;
      }
    }
  });

  if (firstImportLine !== null && lastImportLine !== null) {
    const importChunkContent = lines.slice(firstImportLine - 1, lastImportLine).join('\n');
    chunks.push({
      file: fileName,
      symbol: 'imports',
      type: 'imports',
      startLine: firstImportLine,
      endLine: lastImportLine,
      content: importChunkContent
    });
    for (let l = firstImportLine; l <= lastImportLine; l++) coveredLines.add(l);
  }

  // Helper to determine if a function is a React component
  function isReactComponent(name, node) {
    if (!name) return false;
    const isPascalCase = /^[A-Z][a-zA-Z0-9]*$/.test(name);
    if (!isPascalCase) return false;

    // Check if body contains JSX or returns JSX
    let hasJsx = false;
    try {
      nodePathContainsJsx(node);
      hasJsx = true;
    } catch {
      hasJsx = false;
    }
    return isPascalCase || hasJsx;
  }

  function nodePathContainsJsx(node) {
    const jsonStr = JSON.stringify(node);
    return jsonStr.includes('JSXElement') || jsonStr.includes('JSXFragment');
  }

  // Helper to extract chunk
  function addChunk(symbol, type, loc) {
    if (!loc) return;
    const startLine = loc.start.line;
    const endLine = loc.end.line;
    // Don't add tiny 1-line empty chunks
    if (startLine > endLine) return;

    const chunkContent = lines.slice(startLine - 1, endLine).join('\n');
    chunks.push({
      file: fileName,
      symbol: symbol || 'anonymous',
      type,
      startLine,
      endLine,
      content: chunkContent
    });

    for (let l = startLine; l <= endLine; l++) {
      coveredLines.add(l);
    }
  }

  // Traverse for functions, classes, React components, and methods
  traverse(ast, {
    FunctionDeclaration(nodePath) {
      // Avoid nested inner functions if parent is already capturing it
      if (nodePath.parentPath.isProgram() || nodePath.parentPath.isExportDeclaration()) {
        const name = nodePath.node.id ? nodePath.node.id.name : 'anonymous_function';
        const type = isReactComponent(name, nodePath.node) ? 'react_component' : 'function';
        addChunk(name, type, nodePath.node.loc);
      }
    },
    VariableDeclaration(nodePath) {
      // Check for const MyComp = () => { ... } or const search = function() { ... }
      if (nodePath.parentPath.isProgram() || nodePath.parentPath.isExportDeclaration()) {
        nodePath.node.declarations.forEach(decl => {
          if (decl.init && (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression')) {
            const name = decl.id ? decl.id.name : 'anonymous';
            const type = isReactComponent(name, decl.init) ? 'react_component' : 'function';
            addChunk(name, type, nodePath.node.loc);
          }
        });
      }
    },
    ClassDeclaration(nodePath) {
      if (nodePath.parentPath.isProgram() || nodePath.parentPath.isExportDeclaration()) {
        const name = nodePath.node.id ? nodePath.node.id.name : 'AnonymousClass';
        addChunk(name, 'class', nodePath.node.loc);
      }
    },
    TSTypeAliasDeclaration(nodePath) {
      if (nodePath.parentPath.isProgram() || nodePath.parentPath.isExportDeclaration()) {
        const name = nodePath.node.id ? nodePath.node.id.name : 'TypeAlias';
        addChunk(name, 'type_definition', nodePath.node.loc);
      }
    },
    TSInterfaceDeclaration(nodePath) {
      if (nodePath.parentPath.isProgram() || nodePath.parentPath.isExportDeclaration()) {
        const name = nodePath.node.id ? nodePath.node.id.name : 'Interface';
        addChunk(name, 'type_definition', nodePath.node.loc);
      }
    }
  });

  // Check uncovered sections of code (e.g. top-level effects, exports, route registrations)
  const uncoveredIntervals = [];
  let inUncovered = false;
  let intervalStart = 1;

  for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
    const isCovered = coveredLines.has(lineNum);
    const isBlank = lines[lineNum - 1].trim().length === 0;

    if (!isCovered && !isBlank) {
      if (!inUncovered) {
        inUncovered = true;
        intervalStart = lineNum;
      }
    } else if (inUncovered && (isCovered || lineNum === lines.length)) {
      uncoveredIntervals.push({ start: intervalStart, end: isCovered ? lineNum - 1 : lineNum });
      inUncovered = false;
    }
  }
  if (inUncovered) {
    uncoveredIntervals.push({ start: intervalStart, end: lines.length });
  }

  for (const interval of uncoveredIntervals) {
    // Only add if interval spans meaningful content
    const intervalLines = lines.slice(interval.start - 1, interval.end);
    const contentText = intervalLines.join('\n').trim();
    if (contentText.length > 20) {
      chunks.push({
        file: fileName,
        symbol: `top_level_${interval.start}_${interval.end}`,
        type: 'block',
        startLine: interval.start,
        endLine: interval.end,
        content: intervalLines.join('\n')
      });
    }
  }

  // If no chunks were created (e.g. empty or unconventional code), fallback
  if (chunks.length === 0) {
    return chunkGeneric(fileName, content);
  }

  // Sort chunks by startLine
  chunks.sort((a, b) => a.startLine - b.startLine);
  return chunks;
}

/**
 * Chunks Python code based on `def`, `class`, decorators, and indentation.
 */
function chunkPython(fileName, content) {
  const lines = content.split('\n');
  const chunks = [];
  const defOrClassRegex = /^(\s*)(def|class)\s+([A-Za-z0-9_]+)/;
  const decoratorRegex = /^(\s*)@/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Check for decorator preceding def/class
    let decoratorStart = null;
    let curr = i;
    while (curr < lines.length && decoratorRegex.test(lines[curr])) {
      if (decoratorStart === null) decoratorStart = curr;
      curr++;
    }

    if (curr < lines.length && defOrClassRegex.test(lines[curr])) {
      const match = lines[curr].match(defOrClassRegex);
      const indent = match[1].length;
      const kind = match[2]; // 'def' or 'class'
      const symbol = match[3];
      const startLine = (decoratorStart !== null ? decoratorStart : curr) + 1;

      // Find the end line by checking when indentation returns to <= indent and non-empty
      let endIdx = curr + 1;
      while (endIdx < lines.length) {
        const nextLine = lines[endIdx];
        if (nextLine.trim().length === 0) {
          endIdx++;
          continue;
        }
        const nextIndent = nextLine.match(/^(\s*)/)[1].length;
        if (nextIndent <= indent) {
          break;
        }
        endIdx++;
      }

      // Back up past trailing blank lines
      let actualEndIdx = endIdx - 1;
      while (actualEndIdx > curr && lines[actualEndIdx].trim().length === 0) {
        actualEndIdx--;
      }

      const endLine = actualEndIdx + 1;
      const chunkContent = lines.slice(startLine - 1, endLine).join('\n');

      chunks.push({
        file: fileName,
        symbol,
        type: kind === 'class' ? 'class' : 'function',
        startLine,
        endLine,
        content: chunkContent
      });

      i = endIdx;
      continue;
    }

    i++;
  }

  // If no functions/classes found or content remains, include generic blocks
  if (chunks.length === 0) {
    return chunkGeneric(fileName, content);
  }

  chunks.sort((a, b) => a.startLine - b.startLine);
  return chunks;
}

/**
 * Chunks Java / C++ / Go / Rust / C using brace and signature matching.
 */
function chunkCurlyBraceLanguages(fileName, content) {
  const lines = content.split('\n');
  const chunks = [];

  // Patterns for function or class definitions
  const signatureRegex = /^(\s*)(?:(?:public|private|protected|static|final|abstract|synchronized|async|func|fn)\s+)*([A-Za-z0-9_<>[\]]+)\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{?$/;
  const classRegex = /^(\s*)(?:(?:public|private|protected|static|final|abstract)\s+)*(class|interface|struct|enum)\s+([A-Za-z0-9_]+)/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const classMatch = line.match(classRegex);
    const sigMatch = line.match(signatureRegex);

    if (classMatch || sigMatch) {
      const symbol = classMatch ? classMatch[3] : sigMatch[3];
      const type = classMatch ? (classMatch[2] === 'interface' ? 'type_definition' : 'class') : 'function';
      const startLine = i + 1;

      // Track braces to find closing
      let braceCount = 0;
      let started = false;
      let endIdx = i;

      for (let j = i; j < lines.length; j++) {
        const l = lines[j];
        for (const ch of l) {
          if (ch === '{') {
            braceCount++;
            started = true;
          } else if (ch === '}') {
            braceCount--;
          }
        }
        if (started && braceCount <= 0) {
          endIdx = j;
          break;
        }
      }

      if (endIdx > i) {
        const endLine = endIdx + 1;
        const chunkContent = lines.slice(startLine - 1, endLine).join('\n');
        chunks.push({
          file: fileName,
          symbol,
          type,
          startLine,
          endLine,
          content: chunkContent
        });
        i = endIdx + 1;
        continue;
      }
    }
    i++;
  }

  if (chunks.length === 0) {
    return chunkGeneric(fileName, content);
  }

  chunks.sort((a, b) => a.startLine - b.startLine);
  return chunks;
}

/**
 * Safe line-aware fallback chunker with sliding window (35 lines, 8 lines overlap).
 */
function chunkGeneric(fileName, content) {
  const lines = content.split('\n');
  const totalLines = lines.length;
  if (totalLines === 0) return [];

  // If the file is small (<= 40 lines), keep it as a single intact chunk
  if (totalLines <= 40) {
    return [{
      file: fileName,
      symbol: path.basename(fileName),
      type: 'fallback',
      startLine: 1,
      endLine: totalLines,
      content
    }];
  }

  const windowSize = 35;
  const overlap = 8;
  const chunks = [];
  let currentStart = 1;

  while (currentStart <= totalLines) {
    const currentEnd = Math.min(currentStart + windowSize - 1, totalLines);
    const chunkLines = lines.slice(currentStart - 1, currentEnd);

    chunks.push({
      file: fileName,
      symbol: `${path.basename(fileName)}:${currentStart}-${currentEnd}`,
      type: 'fallback',
      startLine: currentStart,
      endLine: currentEnd,
      content: chunkLines.join('\n')
    });

    if (currentEnd >= totalLines) break;
    currentStart += (windowSize - overlap);
  }

  return chunks;
}

/**
 * Main chunkCode entry point.
 * Chooses the appropriate chunking strategy based on file extension.
 */
export function chunkCode(fileName, content) {
  const ext = path.extname(fileName).toLowerCase();

  switch (ext) {
    case '.js':
    case '.jsx':
    case '.ts':
    case '.tsx':
      return chunkWithBabel(fileName, content);

    case '.py':
      return chunkPython(fileName, content);

    case '.java':
    case '.cpp':
    case '.c':
    case '.go':
    case '.rs':
      return chunkCurlyBraceLanguages(fileName, content);

    case '.json':
    case '.md':
    default:
      return chunkGeneric(fileName, content);
  }
}

/**
 * Chunks a collection of validated files.
 */
export function chunkAllFiles(validatedFiles) {
  const allChunks = [];
  for (const file of validatedFiles) {
    const fileChunks = chunkCode(file.fileName, file.content);
    allChunks.push(...fileChunks);
  }
  return allChunks;
}
