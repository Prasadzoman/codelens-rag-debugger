/**
 * EmbeddingService
 * Provides local, free embeddings with replaceable provider architecture.
 */

class LocalDeterministicEmbeddingProvider {
  constructor(dimension = 384) {
    this.dimension = dimension;
  }

  tokenize(text) {
    // Split on punctuation, whitespace, and camelCase
    const words = text
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1);

    const tokens = new Set(words);

    // Add subword character n-grams (3 to 4 grams) for morphological overlap (auth / authorization)
    for (const w of words) {
      if (w.length >= 3) {
        for (let i = 0; i <= w.length - 3; i++) {
          tokens.add(w.slice(i, i + 3));
        }
      }
      if (w.length >= 4) {
        for (let i = 0; i <= w.length - 4; i++) {
          tokens.add(w.slice(i, i + 4));
        }
      }
    }

    return Array.from(tokens);
  }

  hashWord(word) {
    let hash = 5381;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) + hash) + word.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  embedText(text) {
    const tokens = this.tokenize(text);
    const vector = new Float32Array(this.dimension).fill(0.0);

    if (tokens.length === 0) {
      vector[0] = 1.0;
      return Array.from(vector);
    }

    for (const token of tokens) {
      const weight = token.length > 3 ? 1.0 : 0.4;
      const h1 = this.hashWord(token) % this.dimension;
      const h2 = this.hashWord(token + '_2') % this.dimension;
      vector[h1] += weight;
      vector[h2] += weight * 0.5;
    }

    // L2 normalize
    let norm = 0;
    for (let i = 0; i < this.dimension; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < this.dimension; i++) {
        vector[i] /= norm;
      }
    }

    return Array.from(vector);
  }

  async embedDocuments(docs) {
    return docs.map(doc => {
      const text = typeof doc === 'string' ? doc : (doc.content || JSON.stringify(doc));
      return this.embedText(text);
    });
  }

  async embedQuery(query) {
    return this.embedText(query);
  }
}

class XenovaEmbeddingProvider {
  constructor(modelName = 'Xenova/all-MiniLM-L6-v2') {
    this.modelName = modelName;
    this.pipeline = null;
    this.loadingPromise = null;
    this.dimension = 384;
  }

  async getPipeline() {
    if (this.pipeline) return this.pipeline;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      try {
        const { pipeline } = await import('@xenova/transformers');
        this.pipeline = await pipeline('feature-extraction', this.modelName, {
          quantized: true
        });
        return this.pipeline;
      } catch (err) {
        console.warn(`[XenovaEmbeddingProvider] Could not load ONNX model (${err.message}). Falling back to local deterministic embedding.`);
        throw err;
      }
    })();

    return this.loadingPromise;
  }

  async embedDocuments(docs) {
    const pipe = await this.getPipeline();
    const embeddings = [];

    for (const doc of docs) {
      const text = typeof doc === 'string' ? doc : (doc.content || JSON.stringify(doc));
      const truncated = text.slice(0, 1500);
      const output = await pipe(truncated, { pooling: 'mean', normalize: true });
      embeddings.push(Array.from(output.data));
    }

    return embeddings;
  }

  async embedQuery(query) {
    const pipe = await this.getPipeline();
    const truncated = query.slice(0, 1500);
    const output = await pipe(truncated, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }
}

class OllamaEmbeddingProvider {
  constructor(baseUrl = 'http://localhost:11434', model = 'all-minilm') {
    this.baseUrl = baseUrl;
    this.model = model;
    this.dimension = 384;
  }

  async embedText(text) {
    const res = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt: text.slice(0, 1500) })
    });
    if (!res.ok) throw new Error(`Ollama embedding error: ${res.statusText}`);
    const data = await res.json();
    return data.embedding;
  }

  async embedDocuments(docs) {
    const embeddings = [];
    for (const doc of docs) {
      const text = typeof doc === 'string' ? doc : (doc.content || JSON.stringify(doc));
      embeddings.push(await this.embedText(text));
    }
    return embeddings;
  }

  async embedQuery(query) {
    return this.embedText(query);
  }
}

export class EmbeddingService {
  constructor(options = {}) {
    this.providerType = options.provider || process.env.EMBEDDING_PROVIDER || 'local';
    this.deterministicFallback = new LocalDeterministicEmbeddingProvider(384);

    if (this.providerType === 'xenova') {
      this.provider = new XenovaEmbeddingProvider();
    } else if (this.providerType === 'ollama') {
      this.provider = new OllamaEmbeddingProvider(process.env.OLLAMA_BASE_URL, process.env.OLLAMA_EMBED_MODEL);
    } else {
      this.provider = this.deterministicFallback;
    }
  }

  async embedDocuments(chunks) {
    try {
      return await this.provider.embedDocuments(chunks);
    } catch (err) {
      console.warn(`[EmbeddingService] Provider ${this.providerType} failed: ${err.message}. Using local deterministic embeddings.`);
      return await this.deterministicFallback.embedDocuments(chunks);
    }
  }

  async embedQuery(query) {
    try {
      return await this.provider.embedQuery(query);
    } catch (err) {
      console.warn(`[EmbeddingService] Provider ${this.providerType} failed: ${err.message}. Using local deterministic embeddings.`);
      return await this.deterministicFallback.embedQuery(query);
    }
  }

  getDimension() {
    return 384;
  }
}

export const defaultEmbeddingService = new EmbeddingService();
