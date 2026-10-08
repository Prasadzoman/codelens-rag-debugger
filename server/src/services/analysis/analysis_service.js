import { validateFiles } from '../ingestion/file_validator.js';
import { chunkAllFiles } from '../chunking/code_chunker.js';
import { defaultEmbeddingService } from '../embeddings/embedding_service.js';
import { defaultFaissService } from '../retrieval/faiss_service.js';
import { defaultRetrievalService } from '../retrieval/retrieval_service.js';
import { ContextBuilder } from '../llm/context_builder.js';
import { defaultLLMService } from '../llm/llm_provider.js';

export class AnalysisService {
  constructor(options = {}) {
    this.embeddingService = options.embeddingService || defaultEmbeddingService;
    this.faissService = options.faissService || defaultFaissService;
    this.retrievalService = options.retrievalService || defaultRetrievalService;
    this.llmService = options.llmService || defaultLLMService;
  }

  /**
   * Complete end-to-end RAG analysis pipeline.
   * @param {Array<Object>} rawFiles Array of { name/originalname, content/buffer }
   * @param {string} query User debugging query
   * @param {Object} options { sessionId, k }
   */
  async analyze(rawFiles, query, options = {}) {
    const sessionId = options.sessionId || `session_${Date.now()}`;
    const k = options.k || 5;

    // 1. Ingestion & Validation
    const validatedFiles = validateFiles(rawFiles);
    const uploadedFileNames = new Set(validatedFiles.map(f => f.fileName));

    // Compute line count per file
    const fileStats = validatedFiles.map(f => {
      const lineCount = f.content.split('\n').length;
      return {
        fileName: f.fileName,
        extension: f.extension,
        size: f.size,
        lines: lineCount,
        content: f.content
      };
    });
    const totalLines = fileStats.reduce((sum, f) => sum + f.lines, 0);

    // 2. Code-Aware Chunking
    const chunks = chunkAllFiles(validatedFiles);
    if (chunks.length === 0) {
      return {
        status: 'INSUFFICIENT_EVIDENCE',
        diagnosis: 'No readable code chunks could be extracted from uploaded files.',
        errorType: 'other',
        confidence: 0.0,
        primaryLocation: null,
        explanation: 'The uploaded files contained no parseable statements or functions.',
        evidence: [],
        relatedLocations: [],
        suggestedFix: null,
        stats: { files: validatedFiles.length, lines: totalLines, chunks: 0 }
      };
    }

    // 3. Local Embeddings
    const vectors = await this.embeddingService.embedDocuments(chunks);

    // 4. FAISS Indexing
    await this.faissService.buildIndex(vectors, chunks, sessionId);

    // 5. Query Processing & Hybrid Retrieval
    const retrievalResult = await this.retrievalService.retrieve(query, {
      k,
      sessionId
    });

    const retrievedChunks = retrievalResult.retrievedChunks;

    // Check if query is completely empty or no chunks retrieved
    if (!retrievedChunks || retrievedChunks.length === 0) {
      return {
        status: 'INSUFFICIENT_EVIDENCE',
        diagnosis: 'No relevant code chunks retrieved for this query.',
        errorType: 'other',
        confidence: 0.0,
        primaryLocation: null,
        explanation: 'Vector similarity search found no relevant code matching the query.',
        evidence: [],
        relatedLocations: [],
        suggestedFix: null,
        stats: { files: validatedFiles.length, lines: totalLines, chunks: chunks.length }
      };
    }

    // 6. Context Construction
    const systemPrompt = ContextBuilder.buildSystemPrompt();
    const userPrompt = ContextBuilder.buildUserPrompt(query, retrievedChunks);

    // 7. LLM Reasoning
    const rawDiagnosis = await this.llmService.analyze(systemPrompt, userPrompt, retrievedChunks);

    // 8. Hallucination Control & Validation
    const sanitizedDiagnosis = this._validateAndSanitizeOutput(
      rawDiagnosis,
      uploadedFileNames,
      retrievedChunks,
      fileStats
    );

    // 9. Engineering Confidence Heuristic
    const topScore = retrievedChunks.length > 0 ? (retrievedChunks[0].similarity || 0) : 0;
    const hasStackTraceMatch = (retrievalResult.queryInfo.stackFrames || []).length > 0;
    const computedConfidence = parseFloat(
      Math.min(0.98, (topScore * 0.55) + (hasStackTraceMatch ? 0.30 : 0.15) + 0.15).toFixed(2)
    );

    if (sanitizedDiagnosis.status === 'FOUND') {
      sanitizedDiagnosis.confidence = Math.max(sanitizedDiagnosis.confidence || 0.8, computedConfidence);
    }

    // Attach full files and stats for client display
    return {
      ...sanitizedDiagnosis,
      files: fileStats,
      evidence: retrievedChunks.map(rc => ({
        file: rc.chunk.file,
        symbol: rc.chunk.symbol,
        type: rc.chunk.type,
        startLine: rc.chunk.startLine,
        endLine: rc.chunk.endLine,
        similarity: rc.similarity,
        reason: (sanitizedDiagnosis.evidence || []).find(e => e.file === rc.chunk.file)?.reason ||
          `Retrieved with similarity score ${rc.similarity}`,
        content: rc.chunk.content
      })),
      stats: {
        totalFiles: validatedFiles.length,
        totalLines,
        totalChunks: chunks.length,
        retrievedCount: retrievedChunks.length
      }
    };
  }

  _validateAndSanitizeOutput(raw, uploadedFileNames, retrievedChunks, fileStats) {
    if (!raw || typeof raw !== 'object') {
      return {
        status: 'INSUFFICIENT_EVIDENCE',
        diagnosis: 'Malformed model output.',
        errorType: 'other',
        confidence: 0.1,
        primaryLocation: null,
        explanation: 'Model did not return structured diagnosis.',
        evidence: [],
        relatedLocations: [],
        suggestedFix: null
      };
    }

    // Check status
    if (raw.status === 'INSUFFICIENT_EVIDENCE') {
      return {
        status: 'INSUFFICIENT_EVIDENCE',
        diagnosis: raw.diagnosis || 'Insufficient evidence to isolate the error.',
        errorType: raw.errorType || 'other',
        confidence: raw.confidence || 0.2,
        primaryLocation: null,
        explanation: raw.explanation || 'The uploaded files do not provide sufficient evidence.',
        evidence: raw.evidence || [],
        relatedLocations: [],
        suggestedFix: null
      };
    }

    // Hallucination Check 1: Primary location file must exist in uploaded files
    let primary = raw.primaryLocation;
    if (!primary || !uploadedFileNames.has(primary.file)) {
      // Correct to top retrieved chunk if model hallucinated a nonexistent file
      const top = retrievedChunks[0].chunk;
      primary = {
        file: top.file,
        startLine: top.startLine,
        endLine: top.endLine
      };
    } else {
      // Clamp line bounds to actual file line count
      const fileInfo = fileStats.find(f => f.fileName === primary.file);
      if (fileInfo) {
        primary.startLine = Math.max(1, Math.min(primary.startLine || 1, fileInfo.lines));
        primary.endLine = Math.max(primary.startLine, Math.min(primary.endLine || primary.startLine, fileInfo.lines));
      }
    }

    // Hallucination Check 2: Related locations files must exist in uploaded files
    const validRelated = (raw.relatedLocations || []).filter(rel => {
      return rel && uploadedFileNames.has(rel.file);
    });

    return {
      status: 'FOUND',
      diagnosis: raw.diagnosis || 'Suspected issue identified in primary location.',
      errorType: raw.errorType || 'logic_error',
      confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.85,
      primaryLocation: primary,
      explanation: raw.explanation || 'Analysis of retrieved evidence identified potential flaw.',
      evidence: raw.evidence || [],
      relatedLocations: validRelated,
      suggestedFix: raw.suggestedFix || null
    };
  }
}

export const defaultAnalysisService = new AnalysisService();
