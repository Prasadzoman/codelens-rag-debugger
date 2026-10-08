import React from 'react';
import { Terminal, Send, Loader2, Sparkles, AlertCircle } from 'lucide-react';

const PRESETS = [
  {
    label: 'Stale React Filter',
    query: 'Employee search sometimes shows stale results. Find the likely bug and explain why.'
  },
  {
    label: 'Null / Undefined Map',
    query: "TypeError: Cannot read properties of undefined (reading 'map') at EmployeeList.jsx:27"
  },
  {
    label: 'Async Race Condition',
    query: 'Search queries typed in rapid succession display outdated results from earlier slow network responses.'
  }
];

const STAGES = ['Ingesting', 'Parsing & Chunking', 'Local Embedding', 'FAISS Retrieval', 'LLM Diagnosis'];

export function QueryInput({ query, onQueryChange, onAnalyze, isAnalyzing, currentStage, k, onKChange, error }) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-200">Debugging Query / Stack Trace</h2>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 text-[11px]">Top-K Chunks:</span>
            <select
              value={k}
              onChange={(e) => onKChange(Number(e.target.value))}
              disabled={isAnalyzing}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-0.5 focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value={3}>K = 3</option>
              <option value={5}>K = 5</option>
              <option value={8}>K = 8</option>
            </select>
          </div>
        </div>

        {/* Textarea */}
        <textarea
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Describe the issue, paste runtime error, or provide stack trace (e.g. at EmployeeList.jsx:27)..."
          rows={4}
          disabled={isAnalyzing}
          className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyan-500 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none resize-none transition-colors"
        />

        {/* Quick query pills */}
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mr-1">Quick Presets:</span>
          {PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isAnalyzing}
              onClick={() => onQueryChange(p.query)}
              className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 transition-colors disabled:opacity-40"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Progress & Error */}
      <div className="mt-4 pt-3 border-t border-slate-800/80">
        {error && (
          <div className="mb-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {isAnalyzing && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-[11px] text-cyan-400 mb-1.5 font-mono">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Pipeline: {STAGES[currentStage] || 'Processing...'}
              </span>
              <span className="text-slate-400">{currentStage + 1} of {STAGES.length}</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300"
                style={{ width: `${((currentStage + 1) / STAGES.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={onAnalyze}
          disabled={isAnalyzing || !query.trim()}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs rounded-lg shadow-md shadow-cyan-500/10 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyzing Source & Retrieving Evidence...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Analyze with Local RAG</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
