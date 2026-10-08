/**
 * CodeLens API Service
 */

export async function fetchHealth() {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function indexFiles(files) {
  const formData = new FormData();
  for (const f of files) {
    if (f.fileObject) {
      formData.append('files', f.fileObject, f.name);
    } else {
      formData.append('files', new Blob([f.content], { type: 'text/plain' }), f.name);
    }
  }

  const res = await fetch('/api/index', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to index files');
  }

  return res.json();
}

export async function analyzeQuery(files, query, options = {}) {
  const formData = new FormData();
  formData.append('query', query);
  if (options.k) formData.append('k', options.k);

  for (const f of files) {
    if (f.fileObject) {
      formData.append('files', f.fileObject, f.name);
    } else {
      formData.append('files', new Blob([f.content], { type: 'text/plain' }), f.name);
    }
  }

  const res = await fetch('/api/analyze', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Analysis failed');
  }

  return res.json();
}
