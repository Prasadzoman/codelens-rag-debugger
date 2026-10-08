import React, { useState } from 'react';
import { Wrench, Copy, Check, ShieldAlert } from 'lucide-react';

export function SuggestedFixCard({ fix, primaryLocation }) {
  const [copied, setCopied] = useState(false);

  if (!fix) return null;

  const handleCopy = () => {
    if (fix.code) {
      navigator.clipboard.writeText(fix.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-200">Suggested Fix</h2>
        </div>
        {primaryLocation && (
          <span className="text-xs font-mono text-slate-400">
            Target: <strong className="text-slate-200">{primaryLocation.file}</strong> (Lines {primaryLocation.startLine}–{primaryLocation.endLine})
          </span>
        )}
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">
        {fix.description}
      </p>

      {fix.code && (
        <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px] text-slate-400">
            <span className="font-mono">Proposed Modification</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-3.5 font-mono text-xs text-emerald-300/90 overflow-x-auto whitespace-pre">
            {fix.code}
          </pre>
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
        <span>CodeLens does not automatically modify uploaded files. Review and apply changes as needed.</span>
      </div>
    </div>
  );
}
