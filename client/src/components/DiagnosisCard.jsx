import React from 'react';
import { AlertCircle, HelpCircle, ShieldCheck, Link2, MapPin } from 'lucide-react';

export function DiagnosisCard({ diagnosis, onJumpLocation }) {
  if (!diagnosis || diagnosis.status === 'INSUFFICIENT_EVIDENCE') return null;

  const confidencePct = Math.round((diagnosis.confidence || 0.85) * 100);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
      {/* Header with Error Type & Confidence */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <h2 className="text-sm font-semibold text-slate-200">Diagnosis Overview</h2>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            {diagnosis.errorType?.replace(/_/g, ' ') || 'Logic Error'}
          </span>
        </div>

        {/* Confidence metric */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Model Confidence:</span>
          <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono font-semibold text-cyan-400">{confidencePct}%</span>
          </div>
        </div>
      </div>

      {/* Primary Location */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] uppercase font-semibold text-slate-500 tracking-wider block">
              Primary Location
            </span>
            <span className="font-mono text-sm font-semibold text-slate-100">
              {diagnosis.primaryLocation?.file}
              <span className="text-rose-400 ml-1.5">
                (Lines {diagnosis.primaryLocation?.startLine}–{diagnosis.primaryLocation?.endLine})
              </span>
            </span>
          </div>
        </div>

        {diagnosis.primaryLocation && onJumpLocation && (
          <button
            onClick={() => onJumpLocation(diagnosis.primaryLocation.file, diagnosis.primaryLocation.startLine, diagnosis.primaryLocation.endLine)}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium px-3 py-1 rounded bg-slate-800/80 hover:bg-slate-800 border border-cyan-500/30 transition-colors"
          >
            Jump to Code →
          </button>
        )}
      </div>

      {/* Likely Issue Description */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
          Likely Issue
        </h3>
        <p className="text-sm font-medium text-slate-200">
          {diagnosis.diagnosis}
        </p>
      </div>

      {/* Why Section */}
      <div className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-3.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 mb-1.5">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Why this is suspicious</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          {diagnosis.explanation}
        </p>
      </div>

      {/* Multi-File Related Locations */}
      {diagnosis.relatedLocations && diagnosis.relatedLocations.length > 0 && (
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-2">
            <Link2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Related Locations Across Files</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {diagnosis.relatedLocations.map((loc, idx) => (
              <div
                key={idx}
                onClick={() => onJumpLocation && onJumpLocation(loc.file, loc.startLine, loc.endLine)}
                className="p-2.5 rounded bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs transition-colors"
              >
                <div className="font-mono text-cyan-400 font-medium flex items-center justify-between">
                  <span>{loc.file}</span>
                  <span className="text-[11px] text-slate-400">L{loc.startLine}–{loc.endLine}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{loc.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="text-[10px] text-slate-500 italic pt-1">
        * Model confidence is an engineering heuristic derived from retrieval similarity and code coverage, not a formal probability.
      </div>
    </div>
  );
}
