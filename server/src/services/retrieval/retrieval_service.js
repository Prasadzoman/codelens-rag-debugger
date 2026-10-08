import { QueryProcessor } from './query_processor.js';
import { defaultEmbeddingService } from '../embeddings/embedding_service.js';
import { defaultFaissService } from './faiss_service.js';

export class RetrievalService {
  constructor(options = {}) {
    this.embeddingService = options.embeddingService || defaultEmbeddingService;
    this.faissService = options.faissService || defaultFaissService;
    this.defaultK = options.defaultK || 5;
  }

  /**
   * Performs hybrid retrieval for a user query.
   * @param {string} rawQuery
   * @param {Object} options { k, sessionId }
   */
  async retrieve(rawQuery, options = {}) {
    const k = options.k || this.defaultK;
    const sessionId = options.sessionId || 'default';

    // 1. Process and normalize query
    const processedQuery = QueryProcessor.process(rawQuery);

    // 2. Embed the query
    const queryVector = await this.embeddingService.embedQuery(
      processedQuery.normalizedText || rawQuery
    );

    // 3. Search vector index (retrieve more candidates for re-ranking)
    const candidateK = Math.max(k * 2, 10);
    const semanticMatches = await this.faissService.search(queryVector, candidateK, sessionId);

    // 4. Apply hybrid re-ranking (Stack trace boost & file/line heuristics)
    const scoredChunks = semanticMatches.map(match => {
      const chunk = match.chunk;
      let boost = 0;
      const boostReasons = [];

      // File match boost
      if (processedQuery.fileHints.some(f => f.toLowerCase() === chunk.file.toLowerCase())) {
        boost += 0.25;
        boostReasons.push(`Mentioned file '${chunk.file}'`);
      }

      // Line match boost (Stack frame or line reference)
      const matchesLine = processedQuery.lineHints.some(line => {
        return line >= chunk.startLine && line <= chunk.endLine;
      });
      if (matchesLine) {
        boost += 0.35;
        boostReasons.push(`Contains stack-trace line`);
      }

      // Symbol match boost
      if (chunk.symbol && processedQuery.symbolHints.some(s => s.toLowerCase() === chunk.symbol.toLowerCase())) {
        boost += 0.20;
        boostReasons.push(`Contains referenced symbol '${chunk.symbol}'`);
      }

      // Combine semantic similarity with boost
      const finalScore = Math.min(1.0, (match.similarity * 0.65) + boost);

      return {
        id: match.id,
        chunk,
        similarity: parseFloat(finalScore.toFixed(4)),
        rawSimilarity: parseFloat(match.similarity.toFixed(4)),
        boostReasons
      };
    });

    // Sort by final combined score descending
    scoredChunks.sort((a, b) => b.similarity - a.similarity);

    // Take top K
    const topChunks = scoredChunks.slice(0, k);

    return {
      queryInfo: processedQuery,
      retrievedChunks: topChunks,
      totalCandidates: semanticMatches.length
    };
  }
}

export const defaultRetrievalService = new RetrievalService();
