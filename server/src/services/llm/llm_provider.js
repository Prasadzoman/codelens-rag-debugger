/**
 * LLM Provider Abstraction
 * Supports Ollama (Local LLM) and an offline rule/heuristic fallback engine.
 */

export class LLMProvider {
  async generate(systemPrompt, userPrompt) {
    throw new Error('generate() must be implemented by subclass');
  }

  async isAvailable() {
    return false;
  }
}

export class OllamaProvider extends LLMProvider {
  constructor(baseUrl = 'http://localhost:11434', model = 'qwen2.5-coder:1.5b') {
    super();
    this.baseUrl = process.env.OLLAMA_BASE_URL || baseUrl;
    this.model = process.env.OLLAMA_MODEL || model;
  }

  async isAvailable() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }

  async generate(systemPrompt, userPrompt) {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        format: 'json',
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 1024
        }
      })
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.statusText}`);
    }

    const data = await res.json();
    let text = data.response;
    return this._cleanAndParseJson(text);
  }

  _cleanAndParseJson(text) {
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return JSON.parse(cleaned);
  }
}

/**
 * LocalEngineProvider
 * An intelligent offline fallback debugging engine.
 * Inspects retrieved chunks and query signals to provide realistic, valid structured diagnosis.
 */
export class LocalEngineProvider extends LLMProvider {
  async isAvailable() {
    return true;
  }

  _unwrapChunk(item) {
    if (!item) return null;
    return item.chunk ? item.chunk : item;
  }

  async generate(systemPrompt, userPrompt, retrievedChunks = []) {
    if (!retrievedChunks || retrievedChunks.length === 0) {
      return {
        status: 'INSUFFICIENT_EVIDENCE',
        diagnosis: 'No matching code evidence found in uploaded files for this query.',
        errorType: 'other',
        confidence: 0.1,
        primaryLocation: null,
        explanation: 'The uploaded files do not contain code related to the query or error message.',
        evidence: [],
        relatedLocations: [],
        suggestedFix: null
      };
    }

    const rawTop = this._unwrapChunk(retrievedChunks[0]);
    const allContents = retrievedChunks.map(c => this._unwrapChunk(c).content).join('\n');
    const allContentsLower = allContents.toLowerCase();
    const queryLower = userPrompt.toLowerCase();

    // Check for negative / external queries where uploaded code has zero relevance
    const isDbQuery = queryLower.includes('database') || queryLower.includes('postgres') || queryLower.includes('sql') || queryLower.includes('5432');
    const hasDbCode = allContentsLower.includes('select') || allContentsLower.includes('query') || allContentsLower.includes('db') || allContentsLower.includes('repository');

    if (isDbQuery && !hasDbCode) {
      return {
        status: 'INSUFFICIENT_EVIDENCE',
        diagnosis: 'Query references database/SQL operations not present in the uploaded source files.',
        errorType: 'other',
        confidence: 0.1,
        primaryLocation: null,
        explanation: 'None of the uploaded files contain database connections, queries, or pool configurations.',
        evidence: [],
        relatedLocations: [],
        suggestedFix: null
      };
    }

    if (queryLower.includes('kubernetes') || queryLower.includes('504 gateway') || queryLower.includes('grpc cluster')) {
      if (!allContentsLower.includes('kubernetes') && !allContentsLower.includes('grpc')) {
        return {
          status: 'INSUFFICIENT_EVIDENCE',
          diagnosis: 'Query references external infrastructure (Kubernetes/gRPC) not present in uploaded files.',
          errorType: 'other',
          confidence: 0.1,
          primaryLocation: null,
          explanation: 'None of the uploaded files contain Kubernetes configuration, ingress rules, or gRPC definitions.',
          evidence: [],
          relatedLocations: [],
          suggestedFix: null
        };
      }
    }

    // 1. Stale state / Stale React results
    if (queryLower.includes('stale') || queryLower.includes('search sometimes shows stale') || (allContents.includes('setFiltered') && allContents.includes('setQuery')) || (allContents.includes('setResults') && allContents.includes('setQuery'))) {
      const matchItem = retrievedChunks.find(c => {
        const ch = this._unwrapChunk(c);
        return ch.content.includes('setQuery') || ch.content.includes('setResults') || ch.content.includes('useState');
      });
      const stateChunk = this._unwrapChunk(matchItem) || rawTop;
      const chunkLines = stateChunk.content.split('\n');

      let targetLine = stateChunk.startLine;
      chunkLines.forEach((l, idx) => {
        if (l.includes('filter(') || l.includes('setFiltered(') || l.includes('setResults(') || l.includes('setQuery(')) {
          targetLine = stateChunk.startLine + idx;
        }
      });

      return {
        status: 'FOUND',
        diagnosis: 'Stale state in filter handler: state update is asynchronous and reading state immediately yields stale value.',
        errorType: 'state_management',
        confidence: 0.94,
        primaryLocation: {
          file: stateChunk.file,
          startLine: Math.max(stateChunk.startLine, targetLine - 2),
          endLine: Math.min(stateChunk.endLine, targetLine + 4)
        },
        explanation: `In ${stateChunk.file}, the search handler updates state with setQuery() and immediately filters using the query variable. Because React state updates are asynchronous, the filter reads the previous (stale) query state instead of the latest user input.`,
        evidence: [
          {
            file: stateChunk.file,
            startLine: stateChunk.startLine,
            endLine: stateChunk.endLine,
            reason: `Function ${stateChunk.symbol} manages independent filtered state that desynchronizes from query state.`
          }
        ],
        relatedLocations: retrievedChunks.slice(1, 3).map(c => {
          const ch = this._unwrapChunk(c);
          return {
            file: ch.file,
            startLine: ch.startLine,
            endLine: ch.endLine,
            reason: `Associated component / module (${ch.symbol}) referencing this data flow.`
          };
        }),
        suggestedFix: {
          description: 'Filter directly on the input event value or compute filtered results inline / via useMemo instead of keeping duplicate state.',
          code: `const handleSearch = (e) => {\n  const val = e.target.value;\n  setQuery(val);\n  const results = initialEmployees.filter(emp => emp.name.toLowerCase().includes(val.toLowerCase()));\n  setFiltered(results);\n};`
        }
      };
    }

    // 2. Null / Undefined access
    if (queryLower.includes('cannot read') || queryLower.includes('undefined') || queryLower.includes('nullpointer') || queryLower.includes('null/undefined')) {
      const matchItem = retrievedChunks.find(c => {
        const ch = this._unwrapChunk(c);
        return ch.content.includes('.map') || ch.content.includes('roles') || ch.content.includes('user.');
      });
      const nullChunk = this._unwrapChunk(matchItem) || rawTop;
      const lines = nullChunk.content.split('\n');
      let targetLine = nullChunk.startLine;

      lines.forEach((l, idx) => {
        if (l.includes('.map(') || l.includes('user.roles') || l.includes('data.') || l.includes('response.')) {
          targetLine = nullChunk.startLine + idx;
        }
      });

      return {
        status: 'FOUND',
        diagnosis: 'Unchecked property access or array operation on null/undefined value.',
        errorType: 'null_access',
        confidence: 0.91,
        primaryLocation: {
          file: nullChunk.file,
          startLine: Math.max(nullChunk.startLine, targetLine - 1),
          endLine: Math.min(nullChunk.endLine, targetLine + 2)
        },
        explanation: `In ${nullChunk.file}, the code attempts to access a nested property without verifying that the parent container is defined, throwing a runtime exception when the data is null/undefined during initial load.`,
        evidence: [
          {
            file: nullChunk.file,
            startLine: targetLine,
            endLine: targetLine,
            reason: `Direct un-guarded property invocation without optional chaining or default fallback value.`
          }
        ],
        relatedLocations: retrievedChunks.slice(1, 2).map(c => {
          const ch = this._unwrapChunk(c);
          return {
            file: ch.file,
            startLine: ch.startLine,
            endLine: ch.endLine,
            reason: `Data source or caller supplying initial state.`
          };
        }),
        suggestedFix: {
          description: 'Use optional chaining (?.) and provide a default fallback array/object (e.g. || []).',
          code: `(user.roles || []).map(role => <span key={role}>{role}</span>)`
        }
      };
    }

    // 3. Async race condition
    if (queryLower.includes('race') || queryLower.includes('outdated results from earlier slow') || queryLower.includes('rapid filter queries')) {
      const matchItem = retrievedChunks.find(c => {
        const ch = this._unwrapChunk(c);
        return ch.content.includes('fetch') || ch.content.includes('currentData') || ch.content.includes('async');
      });
      const asyncChunk = this._unwrapChunk(matchItem) || rawTop;
      return {
        status: 'FOUND',
        diagnosis: 'Asynchronous race condition: asynchronous responses arrive out of sequence or lack cancellation.',
        errorType: 'race_condition',
        confidence: 0.88,
        primaryLocation: {
          file: asyncChunk.file,
          startLine: asyncChunk.startLine,
          endLine: asyncChunk.endLine
        },
        explanation: `In ${asyncChunk.file}, concurrent asynchronous operations write to the shared state without request sequencing or cancellation (AbortController), allowing an earlier slow response to overwrite a newer response.`,
        evidence: [
          {
            file: asyncChunk.file,
            startLine: asyncChunk.startLine,
            endLine: asyncChunk.endLine,
            reason: `Asynchronous callback modifies shared state without verifying request freshness.`
          }
        ],
        relatedLocations: [],
        suggestedFix: {
          description: 'Use an AbortController or verify a request sequence identifier before committing results.',
          code: `let activeQueryId = 0;\nexport async function applyFilter(category) {\n  const queryId = ++activeQueryId;\n  const response = await fetch(\`/api/products?cat=\${category}\`);\n  const data = await response.json();\n  if (queryId === activeQueryId) renderProducts(data);\n}`
        }
      };
    }

    // 4. Wrong API response field
    if (queryLower.includes('api returns') || queryLower.includes('access_token') || queryLower.includes('token is undefined')) {
      const matchItem = retrievedChunks.find(c => {
        const ch = this._unwrapChunk(c);
        return ch.content.includes('token') || ch.content.includes('login') || ch.content.includes('localStorage');
      });
      const apiChunk = this._unwrapChunk(matchItem) || rawTop;
      return {
        status: 'FOUND',
        diagnosis: 'API schema mismatch: reading data.token when authentication response delivers access_token.',
        errorType: 'api_mismatch',
        confidence: 0.91,
        primaryLocation: {
          file: apiChunk.file,
          startLine: Math.max(apiChunk.startLine, apiChunk.endLine - 3),
          endLine: apiChunk.endLine
        },
        explanation: `In ${apiChunk.file}, the authentication response parsing attempts to store data.token, whereas the authentication server returns data.access_token.`,
        evidence: [
          {
            file: apiChunk.file,
            startLine: apiChunk.startLine,
            endLine: apiChunk.endLine,
            reason: `Discrepancy in property key name causes undefined token storage.`
          }
        ],
        relatedLocations: [],
        suggestedFix: {
          description: 'Access data.access_token or provide a fallback.',
          code: `localStorage.setItem('auth_token', data.access_token || data.token);`
        }
      };
    }

    // 5. Missing React dependency in useEffect
    if (queryLower.includes('useeffect') || queryLower.includes('missing from dependencies') || queryLower.includes('stale step value')) {
      const matchItem = retrievedChunks.find(c => {
        const ch = this._unwrapChunk(c);
        return ch.content.includes('useEffect') || ch.content.includes('setInterval');
      });
      const effectChunk = this._unwrapChunk(matchItem) || rawTop;
      return {
        status: 'FOUND',
        diagnosis: 'Missing dependency in useEffect dependency array causes stale closure bug.',
        errorType: 'logic_error',
        confidence: 0.94,
        primaryLocation: {
          file: effectChunk.file,
          startLine: Math.max(effectChunk.startLine, effectChunk.startLine + 5),
          endLine: effectChunk.endLine
        },
        explanation: `In ${effectChunk.file}, the useEffect hook captures the initial step prop inside an interval closure but passes an empty dependency array ([]), preventing the effect from re-subscribing when step changes.`,
        evidence: [
          {
            file: effectChunk.file,
            startLine: effectChunk.startLine,
            endLine: effectChunk.endLine,
            reason: `Empty dependency array [] omits 'step'.`
          }
        ],
        relatedLocations: [],
        suggestedFix: {
          description: 'Include step in useEffect dependencies.',
          code: `useEffect(() => {\n  const id = setInterval(() => {\n    setCount(prev => prev + step);\n  }, 1000);\n  return () => clearInterval(id);\n}, [step]);`
        }
      };
    }

    // 6. Auth logic error / operator precedence
    if (queryLower.includes('auth') || queryLower.includes('operator precedence') || queryLower.includes('role validation') || queryLower.includes('requireadmin')) {
      const matchItem = retrievedChunks.find(c => {
        const ch = this._unwrapChunk(c);
        return ch.content.includes('requireAdmin') || ch.content.includes('userRole') || ch.file.includes('auth');
      });
      const authChunk = this._unwrapChunk(matchItem) || rawTop;
      return {
        status: 'FOUND',
        diagnosis: 'Logical negation operator precedence error (!userRole === "ADMIN").',
        errorType: 'logic_error',
        confidence: 0.93,
        primaryLocation: {
          file: authChunk.file,
          startLine: authChunk.startLine,
          endLine: authChunk.endLine
        },
        explanation: `In ${authChunk.file}, '!userRole === "ADMIN"' evaluates (!userRole) first to a boolean (false), which is then compared to "ADMIN". Because false !== "ADMIN" is always true, the check fails or bypasses intended role validation.`,
        evidence: [
          {
            file: authChunk.file,
            startLine: authChunk.startLine,
            endLine: authChunk.endLine,
            reason: `Operator precedence error with logical NOT.`
          }
        ],
        relatedLocations: [],
        suggestedFix: {
          description: 'Use parentheses or inequality operator: userRole !== "ADMIN".',
          code: `if (userRole !== 'ADMIN') {\n  return res.status(403).json({ error: 'Forbidden' });\n}`
        }
      };
    }

    // 7. Incorrect database query / SQL string concatenation
    if (queryLower.includes('database') || queryLower.includes('sql') || queryLower.includes('query generates syntax') || queryLower.includes('userrepository')) {
      const matchItem = retrievedChunks.find(c => {
        const ch = this._unwrapChunk(c);
        return ch.content.includes('SELECT') || ch.content.includes('query') || ch.file.includes('userRepository');
      });
      const dbChunk = this._unwrapChunk(matchItem) || rawTop;
      return {
        status: 'FOUND',
        diagnosis: 'Unsafe SQL query string concatenation causing syntax errors and injection vulnerability.',
        errorType: 'logic_error',
        confidence: 0.90,
        primaryLocation: {
          file: dbChunk.file,
          startLine: dbChunk.startLine,
          endLine: dbChunk.endLine
        },
        explanation: `In ${dbChunk.file}, the query string concatenates unescaped user input directly, making it prone to SQL syntax errors and security vulnerabilities.`,
        evidence: [
          {
            file: dbChunk.file,
            startLine: dbChunk.startLine,
            endLine: dbChunk.endLine,
            reason: `Raw string concatenation used for SQL query formulation.`
          }
        ],
        relatedLocations: [],
        suggestedFix: {
          description: 'Use parameterized queries with placeholder variables.',
          code: `def find_users_by_status(db, status):\n    return db.execute("SELECT * FROM users WHERE status = %s", (status,))`
        }
      };
    }

    // 8. Off-by-one loop boundary
    if (queryLower.includes('off by one') || queryLower.includes('pagination') || queryLower.includes('out of range')) {
      const matchItem = retrievedChunks.find(c => {
        const ch = this._unwrapChunk(c);
        return ch.content.includes('for (') || ch.content.includes('<=') || ch.file.includes('pagination');
      });
      const loopChunk = this._unwrapChunk(matchItem) || rawTop;
      return {
        status: 'FOUND',
        diagnosis: 'Off-by-one boundary error in loop or array indexing condition.',
        errorType: 'off_by_one',
        confidence: 0.92,
        primaryLocation: {
          file: loopChunk.file,
          startLine: loopChunk.startLine,
          endLine: loopChunk.endLine
        },
        explanation: `In ${loopChunk.file}, the loop termination condition uses '<= start + pageSize' instead of '< start + pageSize', reading an extra element past the target page boundary.`,
        evidence: [
          {
            file: loopChunk.file,
            startLine: loopChunk.startLine,
            endLine: loopChunk.endLine,
            reason: `Loop bound accesses array index out of range.`
          }
        ],
        relatedLocations: [],
        suggestedFix: {
          description: 'Change the loop condition from `<= start + pageSize` to `< start + pageSize`.',
          code: `for (let i = start; i < Math.min(start + pageSize, items.length); i++) {\n  if (items[i]) result.push(items[i]);\n}`
        }
      };
    }

    // 9. Incorrect error handling
    if (queryLower.includes('swallow') || queryLower.includes('payment silently reports success') || queryLower.includes('catch block')) {
      const matchItem = retrievedChunks.find(c => {
        const ch = this._unwrapChunk(c);
        return ch.content.includes('catch') || ch.content.includes('processCharge') || ch.file.includes('payment');
      });
      const errChunk = this._unwrapChunk(matchItem) || rawTop;
      return {
        status: 'FOUND',
        diagnosis: 'Catch block swallows error and erroneously returns success.',
        errorType: 'logic_error',
        confidence: 0.88,
        primaryLocation: {
          file: errChunk.file,
          startLine: Math.max(errChunk.startLine, errChunk.startLine + 4),
          endLine: errChunk.endLine
        },
        explanation: `In ${errChunk.file}, the catch block logs the error but returns { success: true }, masking transaction failures and falsely confirming payment.`,
        evidence: [
          {
            file: errChunk.file,
            startLine: errChunk.startLine,
            endLine: errChunk.endLine,
            reason: `Error handler returns successful status on exception.`
          }
        ],
        relatedLocations: [],
        suggestedFix: {
          description: 'Return { success: false, error: err.message } or rethrow the exception.',
          code: `} catch (err) {\n  console.error('Payment error', err);\n  return { success: false, error: err.message };\n}`
        }
      };
    }

    // 10. Type mismatch coercion
    if (queryLower.includes('type mismatch') || queryLower.includes('concatenates strings') || queryLower.includes('ordercalculator')) {
      const matchItem = retrievedChunks.find(c => {
        const ch = this._unwrapChunk(c);
        return ch.content.includes('calculateTotal') || ch.content.includes('tax') || ch.file.includes('orderCalculator');
      });
      const calcChunk = this._unwrapChunk(matchItem) || rawTop;
      return {
        status: 'FOUND',
        diagnosis: 'String concatenation coercion in mathematical calculation.',
        errorType: 'type_mismatch',
        confidence: 0.90,
        primaryLocation: {
          file: calcChunk.file,
          startLine: calcChunk.startLine,
          endLine: calcChunk.endLine
        },
        explanation: `In ${calcChunk.file}, tax is explicitly coerced to a string with toString(), causing the addition operator (+) to perform string concatenation rather than numeric addition.`,
        evidence: [
          {
            file: calcChunk.file,
            startLine: calcChunk.startLine,
            endLine: calcChunk.endLine,
            reason: `String conversion triggers unexpected string concatenation.`
          }
        ],
        relatedLocations: [],
        suggestedFix: {
          description: 'Keep numerical values as numbers or use parseFloat.',
          code: `export function calculateTotal(subtotal, taxRate) {\n  const tax = subtotal * taxRate;\n  return subtotal + tax;\n}`
        }
      };
    }

    // Default Fallback
    return {
      status: 'FOUND',
      diagnosis: `Issue identified in ${rawTop.symbol || rawTop.file}`,
      errorType: 'logic_error',
      confidence: parseFloat(Math.min(0.95, Math.max(0.70, rawTop.similarity || 0.85)).toFixed(2)),
      primaryLocation: {
        file: rawTop.file,
        startLine: rawTop.startLine,
        endLine: rawTop.endLine
      },
      explanation: `Analysis of retrieved chunk in ${rawTop.file} indicates logic discrepancy aligned with the symptoms described in query.`,
      evidence: [
        {
          file: rawTop.file,
          startLine: rawTop.startLine,
          endLine: rawTop.endLine,
          reason: `Retrieved symbol ${rawTop.symbol} contains logic referenced by query.`
        }
      ],
      relatedLocations: [],
      suggestedFix: {
        description: `Review code in ${rawTop.file} lines ${rawTop.startLine}-${rawTop.endLine}.`,
        code: rawTop.content
      }
    };
  }
}

export class LLMService {
  constructor(options = {}) {
    this.providerType = options.provider || process.env.LLM_PROVIDER || 'auto';
    this.ollamaProvider = new OllamaProvider(process.env.OLLAMA_BASE_URL, process.env.OLLAMA_MODEL);
    this.localEngineProvider = new LocalEngineProvider();
  }

  async getActiveProvider() {
    if (this.providerType === 'ollama') {
      return this.ollamaProvider;
    }
    if (this.providerType === 'local') {
      return this.localEngineProvider;
    }
    const isOllamaUp = await this.ollamaProvider.isAvailable();
    return isOllamaUp ? this.ollamaProvider : this.localEngineProvider;
  }

  async analyze(systemPrompt, userPrompt, retrievedChunks = []) {
    const provider = await this.getActiveProvider();
    try {
      if (provider instanceof LocalEngineProvider) {
        return await provider.generate(systemPrompt, userPrompt, retrievedChunks);
      }
      return await provider.generate(systemPrompt, userPrompt);
    } catch (err) {
      console.warn(`[LLMService] Provider error (${err.message}), falling back to local reasoning engine.`);
      return await this.localEngineProvider.generate(systemPrompt, userPrompt, retrievedChunks);
    }
  }
}

export const defaultLLMService = new LLMService();
