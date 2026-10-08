import { defaultAnalysisService } from '../services/analysis/analysis_service.js';
import { validateFiles } from '../services/ingestion/file_validator.js';
import { chunkAllFiles } from '../services/chunking/code_chunker.js';
import { defaultFaissService } from '../services/retrieval/faiss_service.js';
import { defaultLLMService } from '../services/llm/llm_provider.js';

export class AnalysisController {
  /**
   * Health check endpoint
   */
  static async getHealth(req, res) {
    try {
      const faissOk = await defaultFaissService.checkAvailability();
      const activeProvider = await defaultLLMService.getActiveProvider();
      const llmAvailable = await activeProvider.isAvailable();

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        faiss: {
          available: faissOk,
          engine: 'faiss-cpu (1.15.1)'
        },
        llm: {
          provider: defaultLLMService.providerType,
          available: llmAvailable
        },
        embedding: {
          dimension: 384,
          type: 'local'
        }
      });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  }

  /**
   * Index endpoint: parses & chunks files without running full analysis
   */
  static async indexFiles(req, res) {
    try {
      let rawFiles = [];
      if (req.files && req.files.length > 0) {
        rawFiles = req.files.map(f => ({
          name: f.originalname,
          buffer: f.buffer
        }));
      } else if (req.body.files && Array.isArray(req.body.files)) {
        rawFiles = req.body.files;
      }

      if (rawFiles.length === 0) {
        return res.status(400).json({ error: 'No files provided.' });
      }

      const validated = validateFiles(rawFiles);
      const chunks = chunkAllFiles(validated);
      const totalLines = validated.reduce((sum, f) => sum + f.content.split('\n').length, 0);

      res.json({
        filesCount: validated.length,
        linesCount: totalLines,
        chunksCount: chunks.length,
        files: validated.map(f => ({
          fileName: f.fileName,
          lines: f.content.split('\n').length,
          size: f.size
        })),
        chunks: chunks.map(c => ({
          file: c.file,
          symbol: c.symbol,
          type: c.type,
          startLine: c.startLine,
          endLine: c.endLine
        }))
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * Full RAG analyze endpoint
   */
  static async analyze(req, res) {
    try {
      let rawFiles = [];
      let query = req.body.query || '';

      if (req.files && req.files.length > 0) {
        rawFiles = req.files.map(f => ({
          name: f.originalname,
          buffer: f.buffer
        }));
      } else if (req.body.files && Array.isArray(req.body.files)) {
        rawFiles = req.body.files;
      }

      if (rawFiles.length === 0) {
        return res.status(400).json({ error: 'At least one file is required.' });
      }

      if (!query || !query.trim()) {
        return res.status(400).json({ error: 'Debugging query / error message is required.' });
      }

      const sessionId = req.body.sessionId || `session_${Date.now()}`;
      const k = parseInt(req.body.k, 10) || 5;

      const result = await defaultAnalysisService.analyze(rawFiles, query, {
        sessionId,
        k
      });

      res.json(result);
    } catch (err) {
      console.error('[AnalysisController] Error:', err);
      res.status(500).json({ error: err.message });
    }
  }
}
