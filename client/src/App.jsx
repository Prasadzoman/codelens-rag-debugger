import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { FileUploader } from './components/FileUploader';
import { QueryInput } from './components/QueryInput';
import { CodeViewer } from './components/CodeViewer';
import { DiagnosisCard } from './components/DiagnosisCard';
import { EvidenceList } from './components/EvidenceList';
import { SuggestedFixCard } from './components/SuggestedFixCard';
import { InsufficientEvidenceCard } from './components/InsufficientEvidenceCard';
import { fetchHealth, analyzeQuery, indexFiles } from './services/api';
import { DEMO_FILES, DEMO_QUERY } from './demoFiles';
import { Code2 } from 'lucide-react';

export function App() {
  const [health, setHealth] = useState(null);
  const [files, setFiles] = useState([]);
  const [query, setQuery] = useState('');
  const [k, setK] = useState(5);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [error, setError] = useState(null);

  // Diagnosis results
  const [diagnosis, setDiagnosis] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [highlightRange, setHighlightRange] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(err => console.warn('Health check err:', err));
  }, []);

  // Update index stats when files change
  useEffect(() => {
    if (files.length === 0) {
      setStats(null);
      setSelectedFile(null);
      return;
    }

    if (!selectedFile || !files.find(f => (f.fileName || f.name) === (selectedFile.fileName || selectedFile.name))) {
      setSelectedFile(files[0]);
    }

    indexFiles(files)
      .then(res => {
        setStats({
          totalFiles: res.filesCount,
          totalLines: res.linesCount,
          totalChunks: res.chunksCount
        });
      })
      .catch(() => {
        const totalLines = files.reduce((s, f) => s + (f.lines || 0), 0);
        setStats({
          totalFiles: files.length,
          totalLines,
          totalChunks: Math.max(files.length * 2, 4)
        });
      });
  }, [files]);

  const handleLoadDemo = () => {
    setFiles(DEMO_FILES);
    setQuery(DEMO_QUERY);
    setSelectedFile(DEMO_FILES[0]);
    setDiagnosis(null);
    setHighlightRange(null);
    setError(null);
  };

  const handleReset = () => {
    setFiles([]);
    setQuery('');
    setDiagnosis(null);
    setSelectedFile(null);
    setHighlightRange(null);
    setStats(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      setError('Please upload at least one source file before analyzing.');
      return;
    }
    if (!query.trim()) {
      setError('Please provide a debugging query or error description.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setCurrentStage(0);

    // Smooth stage progress
    const stageTimer = setInterval(() => {
      setCurrentStage(prev => Math.min(prev + 1, 3));
    }, 400);

    try {
      const result = await analyzeQuery(files, query, { k });
      clearInterval(stageTimer);
      setCurrentStage(4);

      setDiagnosis(result);
      if (result.stats) {
        setStats(result.stats);
      }

      // Auto-focus primary location in code viewer
      if (result.status === 'FOUND' && result.primaryLocation) {
        const targetFile = files.find(f => (f.name || f.fileName) === result.primaryLocation.file);
        if (targetFile) {
          setSelectedFile(targetFile);
        }
        setHighlightRange({
          startLine: result.primaryLocation.startLine,
          endLine: result.primaryLocation.endLine
        });
      } else {
        setHighlightRange(null);
      }
    } catch (err) {
      clearInterval(stageTimer);
      setError(err.message || 'An error occurred during analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleJumpLocation = (fileName, startLine, endLine) => {
    const targetFile = files.find(f => (f.name || f.fileName) === fileName);
    if (targetFile) {
      setSelectedFile(targetFile);
    }
    setHighlightRange({ startLine, endLine });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar
        health={health}
        onLoadDemo={handleLoadDemo}
        onReset={handleReset}
        isAnalyzing={isAnalyzing}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Top Grid: Upload & Query Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 h-full">
            <FileUploader
              files={files}
              onFilesChange={setFiles}
              isAnalyzing={isAnalyzing}
              stats={stats}
            />
          </div>
          <div className="lg:col-span-6 h-full">
            <QueryInput
              query={query}
              onQueryChange={setQuery}
              onAnalyze={handleAnalyze}
              isAnalyzing={isAnalyzing}
              currentStage={currentStage}
              k={k}
              onKChange={setK}
              error={error}
            />
          </div>
        </div>

        {/* Diagnosis & Results Section */}
        {diagnosis && (
          <div className="space-y-6 animate-fadeIn">
            {diagnosis.status === 'INSUFFICIENT_EVIDENCE' ? (
              <InsufficientEvidenceCard diagnosis={diagnosis} />
            ) : (
              <div className="space-y-6">
                {/* Diagnosis Summary Card */}
                <DiagnosisCard
                  diagnosis={diagnosis}
                  onJumpLocation={handleJumpLocation}
                />

                {/* Code Viewer Panel */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Interactive Code Inspector (Highlighted Suspicious Scope)
                    </h3>
                  </div>
                  <CodeViewer
                    file={selectedFile}
                    highlightRange={highlightRange}
                    allFiles={files}
                    onSelectFile={(f) => setSelectedFile(f)}
                  />
                </div>

                {/* Bottom Split: Retrieved Evidence & Suggested Fix */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7">
                    <EvidenceList
                      evidence={diagnosis.evidence}
                      onJumpLocation={handleJumpLocation}
                    />
                  </div>
                  <div className="lg:col-span-5">
                    <SuggestedFixCard
                      fix={diagnosis.suggestedFix}
                      primaryLocation={diagnosis.primaryLocation}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-4 px-6 text-center text-xs text-slate-600">
        <p>CodeLens • Local-First RAG Code Debugging Assistant • FAISS & Local Embeddings • 100% Free</p>
      </footer>
    </div>
  );
}
export default App;
