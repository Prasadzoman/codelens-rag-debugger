import React from 'react';
import { Bug, Sparkles, Database, Cpu, PlayCircle, RefreshCw } from 'lucide-react';

export function Navbar({ health, onLoadDemo, onReset, isAnalyzing }) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Bug className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white font-mono">CodeLens</h1>
              <span className="text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                RAG Debugger
              </span>
            </div>
            <p className="text-xs text-slate-400">Local-first • FAISS retrieval • Free AI diagnosis</p>
          </div>
        </div>

        {/* System Badges & Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-300 bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-lg">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>FAISS:</span>
            <span className="font-mono text-emerald-400 font-medium">
              {health?.faiss?.available ? 'Online' : 'Fallback'}
            </span>
            <span className="text-slate-600">|</span>
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>LLM:</span>
            <span className="font-mono text-cyan-400 font-medium capitalize">
              {health?.llm?.provider || 'Local Engine'}
            </span>
          </div>

          <button
            onClick={onLoadDemo}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-700/50 rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>Load Demo Bug</span>
          </button>

          <button
            onClick={onReset}
            disabled={isAnalyzing}
            title="Reset workspace"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
