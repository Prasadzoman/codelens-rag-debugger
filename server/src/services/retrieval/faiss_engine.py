#!/usr/bin/env python3
"""
FAISS Vector Engine CLI for CodeLens
Manages FAISS IndexFlatIP (cosine similarity on L2-normalized embeddings).
Communicates via JSON stdio with Node.js.
"""

import sys
import json
import os

try:
    import faiss
    import numpy as np
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False


def build_index(vectors, index_path):
    if not FAISS_AVAILABLE:
        return {"status": "error", "message": "faiss or numpy not available in python"}

    if len(vectors) == 0:
        return {"status": "error", "message": "vectors list is empty"}

    dim = len(vectors[0])
    v_arr = np.array(vectors, dtype=np.float32)

    # Normalize vectors for cosine similarity via inner product
    faiss.normalize_L2(v_arr)

    index = faiss.IndexFlatIP(dim)
    index.add(v_arr)

    # Save to disk
    dir_name = os.path.dirname(os.path.abspath(index_path))
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    faiss.write_index(index, index_path)

    return {
        "status": "ok",
        "ntotal": index.ntotal,
        "dimension": dim,
        "indexPath": index_path
    }


def search_index(query_vector, index_path, k=5):
    if not FAISS_AVAILABLE:
        return {"status": "error", "message": "faiss or numpy not available in python"}

    if not os.path.exists(index_path):
        return {"status": "error", "message": f"Index file not found: {index_path}"}

    index = faiss.read_index(index_path)
    q_arr = np.array([query_vector], dtype=np.float32)
    faiss.normalize_L2(q_arr)

    actual_k = min(k, index.ntotal)
    if actual_k <= 0:
        return {"status": "ok", "matches": []}

    distances, indices = index.search(q_arr, actual_k)

    matches = []
    for dist, idx in zip(distances[0], indices[0]):
        if idx >= 0:
            matches.append({
                "id": int(idx),
                "score": float(dist)
            })

    return {"status": "ok", "matches": matches}


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "command required (check|build|search)"}))
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "check":
        print(json.dumps({
            "status": "ok",
            "faissAvailable": FAISS_AVAILABLE,
            "version": getattr(faiss, "__version__", "unknown") if FAISS_AVAILABLE else None
        }))
        sys.exit(0)

    # Read payload from stdin for build and search
    try:
        input_data = sys.stdin.read()
        payload = json.loads(input_data) if input_data.strip() else {}
    except Exception as e:
        print(json.dumps({"status": "error", "message": f"Failed to parse stdin JSON: {str(e)}"}))
        sys.exit(1)

    if cmd == "build":
        vectors = payload.get("vectors", [])
        index_path = payload.get("indexPath", "faiss.index")
        res = build_index(vectors, index_path)
        print(json.dumps(res))

    elif cmd == "search":
        query_vector = payload.get("queryVector", [])
        index_path = payload.get("indexPath", "faiss.index")
        k = payload.get("k", 5)
        res = search_index(query_vector, index_path, k)
        print(json.dumps(res))

    else:
        print(json.dumps({"status": "error", "message": f"Unknown command: {cmd}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
