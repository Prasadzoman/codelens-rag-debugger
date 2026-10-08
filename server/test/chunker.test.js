import { describe, it, expect } from 'vitest';
import { chunkCode } from '../src/services/chunking/code_chunker.js';

describe('code_chunker', () => {
  it('chunks React JSX components and functions with exact line ranges', () => {
    const jsxCode = `import React, { useState } from 'react';

export function EmployeeList({ initialEmployees }) {
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState(initialEmployees);

  function handleSearch(e) {
    const val = e.target.value;
    setQuery(val);
    const results = initialEmployees.filter(emp => emp.name.includes(query));
    setFiltered(results);
  }

  return (
    <div>
      <input value={query} onChange={handleSearch} />
      <ul>
        {filtered.map(emp => <li key={emp.id}>{emp.name}</li>)}
      </ul>
    </div>
  );
}

export function helperFormat(name) {
  return name.trim().toUpperCase();
}
`;

    const chunks = chunkCode('EmployeeList.jsx', jsxCode);
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    const empListChunk = chunks.find(c => c.symbol === 'EmployeeList');
    expect(empListChunk).toBeDefined();
    expect(empListChunk.file).toBe('EmployeeList.jsx');
    expect(empListChunk.type).toBe('react_component');
    expect(empListChunk.startLine).toBe(3);
    expect(empListChunk.endLine).toBe(22);

    const helperChunk = chunks.find(c => c.symbol === 'helperFormat');
    expect(helperChunk).toBeDefined();
    expect(helperChunk.type).toBe('function');
    expect(helperChunk.startLine).toBe(24);
    expect(helperChunk.endLine).toBe(26);
  });

  it('chunks Python functions and classes', () => {
    const pyCode = `import os

class DatabaseClient:
    def __init__(self, host):
        self.host = host

    def connect(self):
        print("Connected to", self.host)

def query_users(db):
    return db.query("SELECT * FROM users")
`;

    const chunks = chunkCode('db.py', pyCode);
    const dbClient = chunks.find(c => c.symbol === 'DatabaseClient');
    expect(dbClient).toBeDefined();
    expect(dbClient.type).toBe('class');
    expect(dbClient.startLine).toBe(3);
    expect(dbClient.endLine).toBe(8);

    const queryFunc = chunks.find(c => c.symbol === 'query_users');
    expect(queryFunc).toBeDefined();
    expect(queryFunc.type).toBe('function');
    expect(queryFunc.startLine).toBe(10);
    expect(queryFunc.endLine).toBe(11);
  });
});
