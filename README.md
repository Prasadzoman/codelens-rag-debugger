# CodeLens — RAG-Powered AI Debugging Assistant

> A developer uploads one or more source files and provides an error message or debugging query. CodeLens retrieves the most relevant code chunks and uses an LLM to identify the likely error location, explain the issue using supporting evidence, and suggest a fix.

[![Demo Video](https://img.shields.io/badge/Demo%20Video-demo%2Fcodelens__demo.webm-blue)](demo/codelens_demo.webm)
[![Tests](https://img.shields.io/badge/Tests-13%2F13%20Passing-brightgreen)](#testing)
[![Benchmarks](https://img.shields.io/badge/Localization%20Accuracy-100%25-brightgreen)](#evaluation-benchmarks)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## The Problem

When developers encounter tricky runtime bugs, subtle state desynchronization, or multi-file regressions, traditional debugging approaches hit friction:
- **Pasting entire repos into cloud LLMs:** Inefficient, expensive, hits context length limits, degrades attention ("lost in the middle"), and leaks private codebase intellectual property.
- **Generic AI Chatbots:** Frequently hallucinate nonexistent files, lines, methods, or third-party packages because they lack grounded retrieval.
- **Keyword Search / Grep:** Lacks semantic understanding of programming logic and causal relationships across files.

**CodeLens solves this by using local, grounded Retrieval-Augmented Generation (RAG).** Code is parsed into syntactic structures, embedded locally into vector space, indexed in FAISS, and queried using hybrid retrieval (semantic similarity + stack-trace boosting). The LLM receives **only retrieved evidence** and is strictly constrained to output structured JSON with file and line localization.

---

## Architecture Overview

```
                 [ Upload Source Code Files ]
                              │
                              ▼
             [ File Ingestion & Security Validation ]
               (Extension check, Traversal guard,
                Binary rejection, Size caps)
                              │
                              ▼
                  [ Code-Aware Chunking ]
            (Babel AST for JS/JSX/TS/TSX, Python blocks,
             C/Java/Go curly-brace scanner, line metadata)
                              │
                              ▼
                  [ Local Vector Embeddings ]
              (384-d normalized vector representation)
                              │
                              ▼
                [ Local FAISS Vector Index ]
            (IndexFlatIP Cosine Similarity on CPU)
                              │
           ┌──────────────────┴──────────────────┐
           │                                     │
    [ User Query / Stack Trace ]                 │
           │                                     │
           ▼                                     ▼
    [ Query Processor ] ───► [ Hybrid Retrieval Engine ]
    (Extracts stack frames,   (Cosine similarity + Stack-trace boost
     line hints, & errors)     + File/Symbol keyword re-ranking)
                                     │
                                     ▼
                        [ Top-K Retrieved Evidence ]
                                     │
                                     ▼
                         [ Context Construction ]
                     (Delimited source boundaries &
                      anti-hallucination prompt)
                                     │
                                     ▼
                       [ Local LLM / Offline Engine ]
                         (Ollama / Local Reasoner)
                                     │
                                     ▼
                        [ Structured Diagnosis & UI ]
                      (Primary location, Suspicious lines,
                       Why explanation, Evidence cards,
                       Interactive Code Viewer, Suggested fix)
```

---

## Core Features (Currently Implemented)

### 1. Code-Aware Chunking (Not Naive Character Slicing)
- **JavaScript, JSX, TypeScript, TSX:** Full Abstract Syntax Tree (AST) parsing via `@babel/parser` and `@babel/traverse`. Chunks align with function declarations, React functional components, arrow functions, class methods, interfaces, and logical blocks.
- **Python:** Structure-aware indentation and `def`/`class`/decorator scanner.
- **Java, C++, C, Go, Rust:** Block-aware brace matching.
- **JSON & Markdown:** Line-aware window chunking fallback.
- **Metadata Preservation:** Every chunk retains `{ file, symbol, type, startLine, endLine, content }` with 1-indexed line numbers.

### 2. Free, Local-First Embeddings
- **Replaceable `EmbeddingService`:**
  - **Local Deterministic Subword Model (Default):** 384-dimensional dense representation with camelCase tokenization and 3–4 char n-grams for morphological overlap (e.g. matching `authorization` with `authMiddleware`).
  - **Transformers.js / ONNX:** Local `Xenova/all-MiniLM-L6-v2` inside Node.js without needing external servers.
  - **Ollama Embeddings:** Pluggable with `nomic-embed-text` or `all-minilm`.

### 3. FAISS Vector Search on CPU
- Python `faiss-cpu (1.15.1)` using `IndexFlatIP` on L2-normalized vectors (exact cosine similarity).
- Bi-directional vector ID to chunk metadata mapping.
- Pure JavaScript in-memory cosine fallback for zero-dependency execution.

### 4. Hybrid Retrieval with Stack-Trace Boost
- Parses stack frames: `at EmployeeList.jsx:27:12` or `File "app.py", line 42`.
- Hybrid scoring formula:
  $$\text{Score} = \min\left(1.0, (\text{Cosine Sim} \times 0.65) + \text{File Boost (0.25)} + \text{Line Boost (0.35)} + \text{Symbol Boost (0.20)}\right)$$
- Configurable Top-K chunks (default $K=5$).

### 5. Structured JSON Diagnosis & Hallucination Control
- Strictly enforced schema:
  - `status`: `"FOUND"` | `"INSUFFICIENT_EVIDENCE"`
  - `diagnosis`: Concise bug summary
  - `errorType`: Category (`logic_error`, `state_management`, `null_access`, `race_condition`, `api_mismatch`, `off_by_one`, etc.)
  - `confidence`: Transparent engineering heuristic (retrieval score + stack-trace presence)
  - `primaryLocation`: `{ file, startLine, endLine }`
  - `explanation`: Detailed "Why?" reasoning based strictly on retrieved chunks
  - `evidence`: Array of retrieved chunks with similarity scores and rationale
  - `relatedLocations`: Multi-file related sites (callers, schemas, handlers)
  - `suggestedFix`: `{ description, code }`
- **Hallucination Guardrails:**
  - The model is instructed: *"Analyze ONLY the uploaded files. NEVER invent filenames or lines."*
  - Output validator verifies all referenced files exist in uploaded set and clamps line numbers to real bounds.
  - Returns `INSUFFICIENT_EVIDENCE` when queries refer to external infrastructure or unprovided files.

### 6. Interactive Developer UI
- Built with React, Vite, and Tailwind CSS in a dark developer-tool aesthetic.
- **File Upload Panel:** Drag-and-drop, multi-file support, line and size indicators.
- **Pipeline Progress Bar:** Shows Ingesting → Parsing → Embedding → FAISS Retrieval → Diagnosis.
- **Interactive Code Inspector:** Monaco/syntax-style viewer with line numbers and **pulsing red marker + highlighted suspicious lines**.
- **Evidence Cards:** Expandable retrieved chunks with similarity percentages and explanation.
- **Suggested Fix Panel:** Code snippet with 1-click **Copy Code** button. Non-destructive: CodeLens never overwrites files without user confirmation.

---

## 🎬 Working Demo Video

A complete 14-scene video demonstrating all features (file upload, RAG pipeline, code highlighting, multi-file navigation, evidence inspection, suggested fix, and `INSUFFICIENT_EVIDENCE` handling) is included in the repository:

🎥 **[`demo/codelens_demo.webm`](demo/codelens_demo.webm)** *(10.2 MB)*

To play locally:
```powershell
start demo/codelens_demo.webm
```
Or open in any modern browser (Chrome, Edge, Firefox).

To re-record the automated demo anytime:
```bash
npm run record
```

---

## Evaluation Benchmarks

CodeLens includes an automated evaluation suite (`evaluation/evaluate.js`) testing 11 benchmark cases across 10 defect categories:

| Fixture ID | Category | Expected File | Description |
|---|---|---|---|
| `case_01` | `state_management` | `EmployeeList.jsx` | Stale React state in search filter |
| `case_02` | `null_access` | `UserDashboard.jsx` | Unchecked property access (`user.roles.map`) |
| `case_03` | `race_condition` | `ProductFilter.js` | Out-of-order async response overwrite |
| `case_04` | `api_mismatch` | `authService.js` | Reading `data.token` instead of `access_token` |
| `case_05` | `logic_error` | `TimerComponent.jsx` | Missing dependency in `useEffect` closure |
| `case_06` | `logic_error` | `authMiddleware.js` | Operator precedence error (`!userRole === 'ADMIN'`) |
| `case_07` | `logic_error` | `userRepository.py` | SQL raw string concatenation |
| `case_08` | `off_by_one` | `paginationHelper.js` | Boundary error in loop (`<= start + pageSize`) |
| `case_09` | `logic_error` | `paymentGateway.js` | Swallowed error in catch block returning success |
| `case_10` | `type_mismatch` | `orderCalculator.js` | String coercion concatenation in arithmetic |
| `case_11` | `other (negative)` | *None* | External Kubernetes 504 query -> `INSUFFICIENT_EVIDENCE` |

### Benchmark Results (Measured Locally)

```
===============================================================
📈 ACCURACY & LOCALIZATION BENCHMARKS
===============================================================
Top-1 File Localization Accuracy : 100.0% (10/10)
Top-3 File Localization Accuracy : 100.0% (10/10)
Line Range Hit Rate              : 100.0% (10/10)
Insufficient Evidence Detection  : 100.0% (1/1)
===============================================================
🎉 ALL BENCHMARKS COMPLETED SUCCESSFULLY
```

Run benchmarks yourself:
```bash
npm run eval
```

---

## Security & Safety Guardrails

- **No Code Execution:** Uploaded source files are strictly parsed as text; they are **never executed**.
- **Path Traversal Protection:** Filenames are sanitized via `path.basename`. Null bytes (`\0`) and directory traversal sequences (`..`) are rejected.
- **Binary Rejection:** Files with null bytes in the first 512 bytes are dropped.
- **Size Limits:** Max 500 KB per file, max 20 files per request.
- **Allowed Extensions:** `.js`, `.jsx`, `.ts`, `.tsx`, `.py`, `.java`, `.cpp`, `.c`, `.go`, `.rs`, `.json`, `.md`.
- **Non-Destructive Fixes:** CodeLens proposes fixes but never mutates user source files directly.

---

## Getting Started

### Prerequisites
- **Node.js** $\ge 18$ (Tested on Node.js v24)
- **Python** $\ge 3.10$ with `faiss-cpu` and `numpy` (Optional; pure-JS vector search fallback is included)
- **Ollama** (Optional; auto-detected if running with e.g. `qwen2.5-coder:1.5b`)

### 1. Clone & Install
```bash
git clone https://github.com/Prasadzoman/codelens-rag-debugger.git
cd codelens-rag-debugger

# Install backend and frontend dependencies
npm --prefix server install
npm --prefix client install
```

### 2. (Optional) Install Python FAISS
```bash
python -m pip install faiss-cpu numpy
```

### 3. Build & Run
```bash
# Build frontend
npm --prefix client run build

# Start server
npm --prefix server start
```
Open **`http://localhost:3001`** in your browser.

For development with hot-reload:
```bash
# Terminal 1: Backend
npm run server

# Terminal 2: Frontend (Vite on http://localhost:5173)
npm run client
```

---

## Testing

Run the full test suite:

```bash
# Backend unit & integration tests (9 tests)
npm run test

# Frontend component tests (4 tests)
npm --prefix client run test

# Benchmark evaluation (11 fixtures)
npm run eval
```

---

## Project Structure

```
codelens/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx               # Header, status badges, Load Demo button
│   │   │   ├── FileUploader.jsx         # Drag-drop file ingestion & stats
│   │   │   ├── QueryInput.jsx           # Query textarea & pipeline progress
│   │   │   ├── CodeViewer.jsx           # Monospace code viewer with line highlight
│   │   │   ├── DiagnosisCard.jsx        # Bug overview, confidence, primary location
│   │   │   ├── EvidenceList.jsx         # Retrieved chunks with similarity scores
│   │   │   ├── SuggestedFixCard.jsx     # Proposed fix with copy button
│   │   │   └── InsufficientEvidenceCard.jsx # INSUFFICIENT_EVIDENCE card
│   │   ├── services/api.js              # REST client for backend
│   │   ├── demoFiles.js                 # 1-click sample project loader
│   │   ├── App.jsx                      # Main UI application
│   │   └── main.jsx
│   └── test/
│       └── components.test.jsx          # Frontend Vitest test suite
│
├── server/
│   ├── src/
│   │   ├── services/
│   │   │   ├── ingestion/file_validator.js   # Extension, traversal & binary check
│   │   │   ├── chunking/code_chunker.js      # Babel AST & multi-language chunker
│   │   │   ├── embeddings/embedding_service.js # 384-d local embedding provider
│   │   │   ├── retrieval/
│   │   │   │   ├── faiss_engine.py           # FAISS IndexFlatIP Python CLI
│   │   │   │   ├── faiss_service.js          # Node FAISS bridge + JS fallback
│   │   │   │   ├── query_processor.js        # Stack trace & hint extractor
│   │   │   │   └── retrieval_service.js      # Hybrid re-ranking retrieval
│   │   │   ├── llm/
│   │   │   │   ├── context_builder.js        # Delimited prompt formatter
│   │   │   │   └── llm_provider.js           # Ollama + LocalEngine provider
│   │   │   └── analysis/analysis_service.js  # End-to-end RAG orchestrator
│   │   ├── controllers/analysis_controller.js
│   │   ├── routes/api.js                     # REST endpoints
│   │   └── app.js                            # Express app entrypoint
│   ├── test/
│   │   ├── chunker.test.js                   # AST line preservation tests
│   │   ├── faiss.test.js                     # FAISS indexing & search tests
│   │   └── api.test.js                       # API integration tests
│   └── .env.example
│
├── evaluation/
│   ├── test_cases.json                  # 11 ground-truth bug fixtures
│   └── evaluate.js                      # Automated accuracy benchmark runner
│
├── demo/
│   ├── App.jsx
│   ├── EmployeeList.jsx                 # Deliberate stale-state bug
│   ├── api.js
│   ├── EmployeeCard.jsx
│   ├── README.md
│   └── codelens_demo.webm               # 14-scene video demonstration (10.2 MB)
│
├── record_demo.js                       # Playwright automated video recorder
├── Dockerfile
├── docker-compose.yml
├── README.md
└── package.json
```

---

## Current Status vs. Planned Improvements

### Current Implementation (Active)
- [x] Multi-file drag-and-drop ingestion with security validation
- [x] Babel AST-based code-aware chunking preserving exact lines & symbols
- [x] 384-dimensional local embeddings with subword tokenization
- [x] Local FAISS vector indexing (`faiss-cpu`) + in-memory cosine fallback
- [x] Hybrid retrieval combining cosine similarity with stack-trace line boost
- [x] Strict structured JSON output with error localization
- [x] Hallucination guardrails and post-generation whitelist validation
- [x] Code viewer with highlighted suspicious lines
- [x] Multi-file related location tracing
- [x] `INSUFFICIENT_EVIDENCE` detection
- [x] Automated 11-fixture evaluation benchmark
- [x] 100% free, local-first architecture (zero paid APIs)
- [x] Automated 14-scene demo video recording (`demo/codelens_demo.webm`)

### Planned (Future Roadmap)
- [ ] **Tree-sitter Integration** *(Planned)*: Universal AST parsing for 20+ languages.
- [ ] **Graph-RAG Call-Graph Indexing** *(Planned)*: Augment vector similarity with static call-graph edges (caller/callee relations).
- [ ] **Side-by-Side Diff Editor** *(Planned)*: Interactive git-style diff viewer for suggested fixes.
- [ ] **VS Code Extension** *(Planned)*: Inline gutter annotations and diagnostic quick-fixes in VS Code.

---

## License

MIT License. Free to use, modify, and distribute.
