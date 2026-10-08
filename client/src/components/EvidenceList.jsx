import React, { useState } from 'react';
import { Layers, ChevronDown, ChevronUp, FileCode, CheckCircle2 } from 'lucide-react';

export function EvidenceList({ evidence, onJumpLocation }) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  if (!evidence || evidence.length === 0) return null;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-slate-200">
            Retrieved Evidence ({evidence.length} Chunks)
          </h2>
        </div>
        <span className="text-xs text-slate-400">Ranked by Vector Similarity</span>
      </div>

      <div className="space-y-2.5">
        {evidence.map((item, idx) => {
          const isExpanded = expandedIndex === idx;
          const score = typeof item.similarity === 'number' ? (item.similarity * 100).toFixed(0) : '—';

          return (
            <div
              key={idx}
              className="bg-slate-950/70 border border-slate-800 rounded-lg overflow-hidden transition-colors"
            >
              {/* Card Header */}
              <div
                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-900/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-mono text-slate-400 font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-slate-100 truncate">
                        {item.file}
                      </span>
                      <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.2 rounded border border-cyan-800/40">
                        {item.symbol}()
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        Lines {item.startLine}–{item.endLine}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                      {item.reason}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Similarity</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">{score}%</span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Expanded Chunk Details */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-slate-800/60 bg-slate-950/90 space-y-2">
                  <p className="text-xs text-slate-300 italic">
                    Reason: {item.reason}
                  </p>
                  <pre className="p-2.5 bg-slate-900 border border-slate-800 rounded font-mono text-[11px] text-slate-300 overflow-x-auto max-h-48">
                    {item.content}
                  </pre>
                  {onJumpLocation && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => onJumpLocation(item.file, item.startLine, item.endLine)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-medium py-1 px-2.5 rounded bg-slate-800 border border-slate-700 transition-colors"
                      >
                        Inspect in Code Viewer →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
