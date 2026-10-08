import React, { useRef, useEffect } from 'react';
import { FileCode, AlertTriangle } from 'lucide-react';

export function CodeViewer({ file, highlightRange, allFiles, onSelectFile }) {
  const containerRef = useRef(null);
  const targetLineRef = useRef(null);

  // Auto-scroll to highlighted lines when they change
  useEffect(() => {
    if (targetLineRef.current && typeof targetLineRef.current.scrollIntoView === 'function') {
      targetLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightRange, file]);

  if (!file) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-500 italic">
        Select a file or run analysis to view highlighted code.
      </div>
    );
  }

  const lines = (file.content || '').split('\n');
  const startHighlight = highlightRange ? highlightRange.startLine : null;
  const endHighlight = highlightRange ? highlightRange.endLine : null;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-sm">
      {/* File Tab Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-950/80 border-b border-slate-800 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          {allFiles && allFiles.map((f) => {
            const isActive = f.fileName === file.fileName || f.name === file.name;
            const name = f.fileName || f.name;
            return (
              <button
                key={name}
                onClick={() => onSelectFile(f)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>{name}</span>
              </button>
            );
          })}
        </div>

        {startHighlight && (
          <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded border border-rose-500/20 font-mono shrink-0">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Lines {startHighlight}–{endHighlight}</span>
          </div>
        )}
      </div>

      {/* Code Editor view */}
      <div ref={containerRef} className="overflow-auto max-h-[420px] bg-slate-950 p-2 font-mono text-xs">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((lineText, idx) => {
              const lineNum = idx + 1;
              const isHighlighted = startHighlight && endHighlight && lineNum >= startHighlight && lineNum <= endHighlight;
              const isFirstHighlighted = lineNum === startHighlight;

              return (
                <tr
                  key={lineNum}
                  ref={isFirstHighlighted ? targetLineRef : null}
                  className={`group transition-colors ${
                    isHighlighted
                      ? 'bg-rose-950/30 text-rose-100 hover:bg-rose-950/40'
                      : 'hover:bg-slate-900/60 text-slate-300'
                  }`}
                >
                  {/* Line Number */}
                  <td className="w-12 select-none pr-3 pl-2 py-0.5 text-right text-slate-600 font-mono text-[11px] group-hover:text-slate-400">
                    {lineNum}
                  </td>

                  {/* Marker gutter */}
                  <td className="w-4 select-none py-0.5 text-center">
                    {isHighlighted ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block animate-pulse" />
                    ) : null}
                  </td>

                  {/* Code Line Content */}
                  <td className="py-0.5 pl-2 pr-4 font-mono whitespace-pre text-left">
                    {lineText || ' '}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
