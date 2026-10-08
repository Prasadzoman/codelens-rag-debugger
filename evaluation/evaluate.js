import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defaultAnalysisService } from '../server/src/services/analysis/analysis_service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runEvaluation() {
  console.log('===============================================================');
  console.log('🔬 CODELENS BENCHMARK EVALUATION SUITE');
  console.log('   Testing Local RAG Localization & Diagnosis Accuracy');
  console.log('===============================================================\n');

  const testCasesPath = path.join(__dirname, 'test_cases.json');
  const testCases = JSON.parse(fs.readFileSync(testCasesPath, 'utf8'));

  let top1FileHits = 0;
  let top3FileHits = 0;
  let lineHits = 0;
  let insufficientEvidenceHits = 0;
  let totalPositiveCases = 0;
  let totalNegativeCases = 0;

  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    process.stdout.write(`[${i + 1}/${testCases.length}] Evaluating ${tc.name}... `);

    const startTime = Date.now();
    const response = await defaultAnalysisService.analyze(tc.files, tc.query, {
      sessionId: `eval_${tc.id}_${Date.now()}`,
      k: 5
    });
    const elapsed = Date.now() - startTime;

    let isTop1File = false;
    let isTop3File = false;
    let isLineHit = false;
    let isStatusCorrect = false;

    if (tc.expectedStatus === 'INSUFFICIENT_EVIDENCE') {
      totalNegativeCases++;
      if (response.status === 'INSUFFICIENT_EVIDENCE') {
        insufficientEvidenceHits++;
        isStatusCorrect = true;
      }
    } else {
      totalPositiveCases++;
      if (response.status === 'FOUND') {
        isStatusCorrect = true;

        // Check Top-1 file localization
        if (response.primaryLocation && response.primaryLocation.file === tc.expectedFile) {
          top1FileHits++;
          isTop1File = true;
        }

        // Check Top-3 file localization in retrieved evidence
        const top3Files = (response.evidence || []).slice(0, 3).map(e => e.file);
        if (top3Files.includes(tc.expectedFile) || isTop1File) {
          top3FileHits++;
          isTop3File = true;
        }

        // Check Line-range hit (overlap between diagnosed range and expected range)
        if (response.primaryLocation && tc.expectedLineRange) {
          const [expStart, expEnd] = tc.expectedLineRange;
          const { startLine, endLine } = response.primaryLocation;
          // Overlap check
          const overlaps = Math.max(expStart, startLine) <= Math.min(expEnd, endLine);
          // Proximity check (within 3 lines)
          const closeDistance = Math.abs(startLine - expStart) <= 3 || Math.abs(endLine - expEnd) <= 3;

          if (overlaps || closeDistance) {
            lineHits++;
            isLineHit = true;
          }
        }
      }
    }

    const passed = (tc.expectedStatus === 'INSUFFICIENT_EVIDENCE' && isStatusCorrect) || (isTop1File && isLineHit);
    console.log(passed ? '✅ PASSED' : '⚠️ PARTIAL', `(${elapsed}ms)`);

    results.push({
      id: tc.id,
      name: tc.name,
      category: tc.category,
      expectedFile: tc.expectedFile || 'N/A',
      gotFile: response.primaryLocation ? response.primaryLocation.file : (response.status),
      top1File: isTop1File,
      lineHit: isLineHit,
      status: response.status,
      confidence: response.confidence
    });
  }

  // Print Summary Table
  console.log('\n===============================================================');
  console.log('📊 DETAILED RESULTS TABLE');
  console.log('===============================================================');
  console.table(results.map(r => ({
    Case: r.name,
    Category: r.category,
    'Expected File': r.expectedFile,
    'Got File': r.gotFile,
    'Top-1 File': r.top1File ? '✓' : '✗',
    'Line Hit': r.lineHit ? '✓' : '-',
    Status: r.status,
    Confidence: `${Math.round((r.confidence || 0) * 100)}%`
  })));

  // Calculate Metrics
  const top1Acc = ((top1FileHits / totalPositiveCases) * 100).toFixed(1);
  const top3Acc = ((top3FileHits / totalPositiveCases) * 100).toFixed(1);
  const lineAcc = ((lineHits / totalPositiveCases) * 100).toFixed(1);
  const insuffAcc = totalNegativeCases > 0 ? ((insufficientEvidenceHits / totalNegativeCases) * 100).toFixed(1) : '100.0';

  console.log('===============================================================');
  console.log('📈 ACCURACY & LOCALIZATION BENCHMARKS');
  console.log('===============================================================');
  console.log(`Top-1 File Localization Accuracy : ${top1Acc}% (${top1FileHits}/${totalPositiveCases})`);
  console.log(`Top-3 File Localization Accuracy : ${top3Acc}% (${top3FileHits}/${totalPositiveCases})`);
  console.log(`Line Range Hit Rate              : ${lineAcc}% (${lineHits}/${totalPositiveCases})`);
  console.log(`Insufficient Evidence Detection  : ${insuffAcc}% (${insufficientEvidenceHits}/${totalNegativeCases})`);
  console.log('===============================================================\n');

  // Verify thresholds
  if (top1FileHits < totalPositiveCases * 0.8) {
    console.error('❌ Benchmark failed: Top-1 localization below 80%');
    process.exit(1);
  } else {
    console.log('🎉 ALL BENCHMARKS COMPLETED SUCCESSFULLY');
    process.exit(0);
  }
}

runEvaluation().catch(err => {
  console.error('Fatal evaluation error:', err);
  process.exit(1);
});
