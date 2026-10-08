import React from 'react';
import { AlertCircle, FileSearch, HelpCircle } from 'lucide-react';

export function InsufficientEvidenceCard({ diagnosis }) {
  if (!diagnosis || diagnosis.status !== 'INSUFFICIENT_EVIDENCE') return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 shadow-sm space-y-3">
      <div className="flex items-center gap-2.5 text-amber-400">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <h2 className="text-sm font-semibold uppercase tracking-wider font-mono">
          INSUFFICIENT_EVIDENCE
        </h2>
      </div>

      <p className="text-xs text-amber-200/90 leading-relaxed font-medium">
        {diagnosis.diagnosis || 'The provided files do not contain enough evidence to isolate the error.'}
      </p>

      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 text-xs text-slate-300 space-y-2">
        <div className="flex items-center gap-1.5 font-semibold text-slate-200">
          <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>Why was this returned?</span>
        </div>
        <p className="text-slate-400 leading-relaxed">
          {diagnosis.explanation ||
            'CodeLens adheres to strict hallucination control. When vector retrieval similarity is low or the symptom points to external unprovided files (e.g. backend APIs, database configurations, missing modules), CodeLens refrains from guessing.'}
        </p>
      </div>

      <div className="text-[11px] text-amber-300/70">
        💡 <strong>Tip:</strong> Upload additional related source files or refine your query with specific function names or stack trace lines.
      </div>
    </div>
  );
}
