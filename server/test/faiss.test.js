import { describe, it, expect } from 'vitest';
import { FaissService } from '../src/services/retrieval/faiss_service.js';

describe('FaissService', () => {
  it('checks faiss availability', async () => {
    const faissService = new FaissService();
    const available = await faissService.checkAvailability();
    expect(available).toBe(true);
  });

  it('builds an index and searches Top-K nearest neighbors', async () => {
    const faissService = new FaissService();
    const dim = 4;
    const vectors = [
      [1.0, 0.0, 0.0, 0.0],
      [0.0, 1.0, 0.0, 0.0],
      [0.0, 0.0, 1.0, 0.0],
      [0.0, 0.0, 0.0, 1.0]
    ];
    const chunks = [
      { file: 'a.js', symbol: 'funcA', type: 'function', startLine: 1, endLine: 5, content: 'function a() {}' },
      { file: 'b.js', symbol: 'funcB', type: 'function', startLine: 10, endLine: 15, content: 'function b() {}' },
      { file: 'c.js', symbol: 'funcC', type: 'function', startLine: 20, endLine: 25, content: 'function c() {}' },
      { file: 'd.js', symbol: 'funcD', type: 'function', startLine: 30, endLine: 35, content: 'function d() {}' }
    ];

    const buildRes = await faissService.buildIndex(vectors, chunks, 'test_session');
    expect(buildRes.indexedCount).toBe(4);

    // Search for vector closest to vector 0 ([1, 0, 0, 0])
    const query = [0.95, 0.05, 0.0, 0.0];
    const matches = await faissService.search(query, 2, 'test_session');

    expect(matches.length).toBe(2);
    expect(matches[0].chunk.file).toBe('a.js');
    expect(matches[0].chunk.symbol).toBe('funcA');
    expect(matches[0].similarity).toBeGreaterThan(0.9);
  });
});
