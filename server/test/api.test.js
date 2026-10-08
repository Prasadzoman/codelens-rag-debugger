import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('CodeLens API Endpoints', () => {
  it('GET /api/health returns healthy and faiss status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.faiss.available).toBe(true);
  });

  it('POST /api/index returns chunk and line counts', async () => {
    const testFile = {
      name: 'Calculator.js',
      content: `export function add(a, b) {
  return a + b;
}

export function divide(a, b) {
  if (b === 0) throw new Error("Zero division");
  return a / b;
}`
    };

    const res = await request(app)
      .post('/api/index')
      .send({ files: [testFile] });

    expect(res.status).toBe(200);
    expect(res.body.filesCount).toBe(1);
    expect(res.body.linesCount).toBe(8);
    expect(res.body.chunksCount).toBeGreaterThanOrEqual(2);
  });

  it('POST /api/analyze diagnoses a logic error with structured output', async () => {
    const files = [
      {
        name: 'EmployeeList.jsx',
        content: `import React, { useState } from 'react';

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
      <ul>{filtered.map(emp => <li key={emp.id}>{emp.name}</li>)}</ul>
    </div>
  );
}`
      },
      {
        name: 'api.js',
        content: `export async function fetchEmployees() {
  const res = await fetch('/api/employees');
  return res.json();
}`
      }
    ];

    const res = await request(app)
      .post('/api/analyze')
      .send({
        files,
        query: 'Employee search sometimes shows stale results. Find the likely bug and explain why.'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('FOUND');
    expect(res.body.primaryLocation).toBeDefined();
    expect(res.body.primaryLocation.file).toBe('EmployeeList.jsx');
    expect(res.body.explanation).toBeDefined();
    expect(res.body.evidence.length).toBeGreaterThan(0);
    expect(res.body.confidence).toBeGreaterThan(0.7);
    expect(res.body.suggestedFix).toBeDefined();
  });

  it('POST /api/analyze returns INSUFFICIENT_EVIDENCE when files do not match query', async () => {
    const files = [
      {
        name: 'math.js',
        content: `export function add(a, b) { return a + b; }`
      }
    ];

    const res = await request(app)
      .post('/api/analyze')
      .send({
        files,
        query: 'Why does database connection timeout on port 5432 in postgres pool?'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('Rejects invalid file extensions and malicious paths', async () => {
    const maliciousFiles = [
      {
        name: '../../etc/passwd',
        content: 'malicious payload'
      }
    ];

    const res = await request(app)
      .post('/api/analyze')
      .send({
        files: maliciousFiles,
        query: 'test query'
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Illegal characters|Invalid file path|traversal|Unsupported/i);
  });
});
