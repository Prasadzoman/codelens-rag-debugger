import React, { useRef } from 'react';
import { UploadCloud, FileCode, X, Layers, Hash } from 'lucide-react';

const SUPPORTED_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.json', '.md'];

export function FileUploader({ files, onFilesChange, isAnalyzing, stats }) {
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    if (isAnalyzing) return;
    const droppedFiles = Array.from(e.dataTransfer.files);
    await processIncomingFiles(droppedFiles);
  };

  const handleFileSelect = async (e) => {
    if (isAnalyzing) return;
    const selectedFiles = Array.from(e.target.files);
    await processIncomingFiles(selectedFiles);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processIncomingFiles = async (rawFileList) => {
    const valid = [];
    for (const file of rawFileList) {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!SUPPORTED_EXTS.includes(ext)) {
        alert(`Unsupported file format '${ext}'. Allowed: ${SUPPORTED_EXTS.join(', ')}`);
        continue;
      }
      const text = await file.text();
      valid.push({
        name: file.name,
        content: text,
        size: file.size,
        lines: text.split('\n').length
      });
    }

    // Merge without duplicates by name
    const existingNames = new Set(files.map(f => f.name));
    const newFiles = [...files];
    for (const f of valid) {
      if (existingNames.has(f.name)) {
        const idx = newFiles.findIndex(item => item.name === f.name);
        newFiles[idx] = f;
      } else {
        newFiles.push(f);
      }
    }
    onFilesChange(newFiles);
  };

  const removeFile = (fileName) => {
    onFilesChange(files.filter(f => f.name !== fileName));
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col h-full">
      {/* Title & Stats */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-200">Source Files</h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1">
            <span className="text-slate-500">Files:</span>
            <strong className="text-cyan-400 font-semibold">{files.length}</strong>
          </span>
          <span className="text-slate-700">•</span>
          <span className="flex items-center gap-1">
            <span className="text-slate-500">Lines:</span>
            <strong className="text-slate-300 font-semibold">
              {files.reduce((sum, f) => sum + (f.lines || 0), 0)}
            </strong>
          </span>
          <span className="text-slate-700">•</span>
          <span className="flex items-center gap-1">
            <span className="text-slate-500">Chunks:</span>
            <strong className="text-emerald-400 font-semibold">{stats?.totalChunks || '—'}</strong>
          </span>
        </div>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-800 hover:border-cyan-500/50 bg-slate-950/50 hover:bg-slate-900/50 rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition-colors text-center group"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <div className="w-10 h-10 rounded-full bg-slate-800/80 group-hover:bg-cyan-500/20 text-slate-400 group-hover:text-cyan-400 flex items-center justify-center mb-2 transition-colors">
          <UploadCloud className="w-5 h-5" />
        </div>
        <p className="text-xs font-medium text-slate-300">
          <span className="text-cyan-400">Click to upload</span> or drag and drop files
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          JS, JSX, TS, TSX, Python, Java, Go, Rust, C++ (up to 500 KB)
        </p>
      </div>

      {/* File List */}
      <div className="mt-4 flex-1 overflow-y-auto space-y-2 max-h-56 pr-1">
        {files.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-600 italic">
            No files uploaded yet. Drag source files here or click "Load Demo Bug" above.
          </div>
        ) : (
          files.map((file) => (
            <div
              key={file.name}
              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-800/80 hover:border-slate-700 text-xs transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="font-mono text-slate-200 truncate font-medium">
                  {file.name}
                </span>
                <span className="text-[10px] font-mono text-slate-500 shrink-0">
                  {file.lines} lines • {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(file.name);
                }}
                disabled={isAnalyzing}
                className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors disabled:opacity-40"
                title="Remove file"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
