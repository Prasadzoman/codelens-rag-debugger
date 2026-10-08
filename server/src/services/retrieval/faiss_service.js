import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class FaissService {
  constructor(options = {}) {
    this.pythonPath = options.pythonPath || process.env.PYTHON_BIN || 'python';
    this.scriptPath = path.join(__dirname, 'faiss_engine.py');
    this.dataDir = options.dataDir || path.join(__dirname, '../../../.faiss_data');
    this.metadata = []; // Array of chunk metadata indexed by vector ID
    this.vectors = []; // Local vector cache for fallback
    this.isFaissAvailable = null;

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  async checkAvailability() {
    if (this.isFaissAvailable !== null) return this.isFaissAvailable;

    try {
      const res = await this._runPythonCmd('check', {});
      this.isFaissAvailable = res.status === 'ok' && res.faissAvailable === true;
    } catch {
      this.isFaissAvailable = false;
    }

    return this.isFaissAvailable;
  }

  _runPythonCmd(cmd, payload) {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.pythonPath, [this.scriptPath, cmd], {
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', data => { stdout += data.toString(); });
      proc.stderr.on('data', data => { stderr += data.toString(); });

      proc.on('close', code => {
        if (code !== 0 && !stdout.trim()) {
          return reject(new Error(`Python FAISS process exited with code ${code}: ${stderr}`));
        }
        try {
          const parsed = JSON.parse(stdout);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse FAISS output (${e.message}): ${stdout} | Stderr: ${stderr}`));
        }
      });

      proc.on('error', err => reject(err));

      if (cmd !== 'check') {
        proc.stdin.write(JSON.stringify(payload));
        proc.stdin.end();
      }
    });
  }

  /**
   * Builds the FAISS index with vectors and associates metadata.
   * @param {Array<Array<number>>} vectors
   * @param {Array<Object>} chunks
   * @param {string} sessionId
   */
  async buildIndex(vectors, chunks, sessionId = 'default') {
    if (vectors.length !== chunks.length) {
      throw new Error(`Vectors length (${vectors.length}) does not match chunks length (${chunks.length})`);
    }

    this.metadata = chunks.map((chunk, idx) => ({
      id: idx,
      file: chunk.file,
      symbol: chunk.symbol,
      type: chunk.type,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      content: chunk.content
    }));
    this.vectors = vectors;

    const indexPath = path.join(this.dataDir, `${sessionId}.index`);
    const metaPath = path.join(this.dataDir, `${sessionId}.meta.json`);

    fs.writeFileSync(metaPath, JSON.stringify(this.metadata, null, 2), 'utf8');

    const canUseFaiss = await this.checkAvailability();
    if (canUseFaiss && vectors.length > 0) {
      try {
        const result = await this._runPythonCmd('build', {
          vectors,
          indexPath
        });
        if (result.status !== 'ok') {
          console.warn('[FaissService] Python FAISS build failed, falling back to in-memory cosine search:', result.message);
        }
      } catch (err) {
        console.warn('[FaissService] Python FAISS error, falling back:', err.message);
      }
    }

    return {
      indexedCount: this.metadata.length,
      indexPath,
      metaPath
    };
  }

  /**
   * Search Top-K vectors closest to queryVector.
   * @param {Array<number>} queryVector
   * @param {number} k
   * @param {string} sessionId
   */
  async search(queryVector, k = 5, sessionId = 'default') {
    if (this.metadata.length === 0) {
      return [];
    }

    const indexPath = path.join(this.dataDir, `${sessionId}.index`);
    const canUseFaiss = await this.checkAvailability();

    if (canUseFaiss && fs.existsSync(indexPath)) {
      try {
        const result = await this._runPythonCmd('search', {
          queryVector,
          indexPath,
          k
        });

        if (result.status === 'ok' && Array.isArray(result.matches)) {
          return result.matches.map(m => {
            const chunkMeta = this.metadata[m.id];
            return {
              id: m.id,
              similarity: Math.max(0, Math.min(1, m.score)),
              chunk: chunkMeta
            };
          });
        }
      } catch (err) {
        console.warn('[FaissService] Python FAISS search failed, using fallback:', err.message);
      }
    }

    // In-memory cosine similarity fallback
    return this._fallbackCosineSearch(queryVector, k);
  }

  _fallbackCosineSearch(queryVector, k) {
    if (this.vectors.length === 0) return [];

    const qNorm = Math.sqrt(queryVector.reduce((sum, v) => sum + v * v, 0)) || 1.0;
    const scores = [];

    for (let i = 0; i < this.vectors.length; i++) {
      const vec = this.vectors[i];
      let dot = 0;
      let vNorm = 0;
      for (let j = 0; j < vec.length; j++) {
        dot += vec[j] * queryVector[j];
        vNorm += vec[j] * vec[j];
      }
      vNorm = Math.sqrt(vNorm) || 1.0;
      const sim = Math.max(0, Math.min(1, dot / (qNorm * vNorm)));

      scores.push({
        id: i,
        similarity: sim,
        chunk: this.metadata[i]
      });
    }

    scores.sort((a, b) => b.similarity - a.similarity);
    return scores.slice(0, k);
  }
}

export const defaultFaissService = new FaissService();
