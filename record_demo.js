/**
 * CodeLens Demo Recording Script
 * Uses Playwright to automate the full feature walkthrough and record a .webm video.
 * Output: demo/codelens_demo.webm
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_URL = 'http://localhost:3001';
const VIDEO_DIR = path.join(__dirname, 'demo');
const VIDEO_SIZE = { width: 1440, height: 900 };

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForServer(url, maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(`${url}/api/health`);
      if (r.ok) return true;
    } catch {}
    await sleep(500);
  }
  throw new Error(`Server did not become ready at ${url}`);
}

function startServer() {
  const serverDir = path.join(__dirname, 'server');
  const proc = spawn('node', ['src/app.js'], {
    cwd: serverDir,
    detached: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  proc.stdout.on('data', d => process.stdout.write(`[server] ${d}`));
  proc.stderr.on('data', d => process.stderr.write(`[server] ${d}`));
  return proc;
}

async function record() {
  console.log('🎬 Starting CodeLens demo recording...\n');

  if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

  console.log('🚀 Starting server...');
  const server = startServer();
  await waitForServer(SERVER_URL);
  console.log('✅ Server ready.\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized', '--disable-infobars']
  });

  const context = await browser.newContext({
    viewport: VIDEO_SIZE,
    recordVideo: {
      dir: VIDEO_DIR,
      size: VIDEO_SIZE
    },
    colorScheme: 'dark'
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  // Helper: use role-based button locators to avoid strict-mode collisions
  const btn = (name) => page.getByRole('button', { name, exact: false });

  try {
    // ── SCENE 1: Cold load
    console.log('🎥 Scene 1 — Loading CodeLens...');
    await page.goto(SERVER_URL, { waitUntil: 'networkidle' });
    await sleep(3000);

    // ── SCENE 2: Show health badges
    console.log('🎥 Scene 2 — System health badges...');
    await page.locator('text=FAISS:').first().hover();
    await sleep(2500);

    // ── SCENE 3: Load demo files
    console.log('🎥 Scene 3 — Load Demo Bug...');
    await btn('Load Demo Bug').click();
    await sleep(3000);

    // ── SCENE 4: Show file list
    console.log('🎥 Scene 4 — File list & chunk stats...');
    await page.locator('text=EmployeeList.jsx').first().scrollIntoViewIfNeeded();
    await sleep(2000);

    // Show all 4 files
    await page.locator('text=api.js').first().scrollIntoViewIfNeeded();
    await sleep(1500);
    await page.locator('text=EmployeeCard.jsx').first().scrollIntoViewIfNeeded();
    await sleep(1500);

    // ── SCENE 5: Show query textarea
    console.log('🎥 Scene 5 — Debug query...');
    const textarea = page.locator('textarea');
    await textarea.scrollIntoViewIfNeeded();
    await textarea.click();
    await sleep(2000);

    // ── SCENE 6: Show Top-K selector
    console.log('🎥 Scene 6 — Top-K configurability...');
    const kSelect = page.locator('select');
    await kSelect.selectOption('8');
    await sleep(1500);
    await kSelect.selectOption('5');
    await sleep(1000);

    // ── SCENE 7: Click Analyze
    console.log('🎥 Scene 7 — Running RAG pipeline...');
    await btn('Analyze with Local RAG').click();
    // Watch progress bar appear briefly
    await sleep(1000);
    // Wait for diagnosis to appear
    await page.waitForSelector('text=Diagnosis Overview', { timeout: 30000 });
    console.log('   Analysis complete.');
    await sleep(2500);

    // ── SCENE 8: Scroll through diagnosis card
    console.log('🎥 Scene 8 — Diagnosis overview...');
    await page.locator('text=Diagnosis Overview').scrollIntoViewIfNeeded();
    await sleep(2000);
    await page.locator('text=Primary Location').scrollIntoViewIfNeeded();
    await sleep(2000);
    await page.locator('text=Why this is suspicious').scrollIntoViewIfNeeded();
    await sleep(2000);

    // ── SCENE 9: Jump to highlighted code
    console.log('🎥 Scene 9 — Jumping to highlighted code...');
    const jumpBtn = page.locator('text=Jump to Code →').first();
    if (await jumpBtn.count() > 0) {
      await jumpBtn.click();
    }
    await sleep(2000);
    await page.locator('text=Interactive Code Inspector').scrollIntoViewIfNeeded();
    await sleep(2500);

    // Switch tabs to show multi-file support
    const apiTab = page.locator('button', { hasText: 'api.js' });
    if (await apiTab.count() > 0) {
      await apiTab.first().click();
      await sleep(1500);
    }
    const empTab = page.locator('button', { hasText: 'EmployeeList.jsx' });
    if (await empTab.count() > 0) {
      await empTab.first().click();
      await sleep(1500);
    }

    // ── SCENE 10: Evidence list
    console.log('🎥 Scene 10 — Retrieved evidence chunks...');
    await page.locator('text=Retrieved Evidence').scrollIntoViewIfNeeded();
    await sleep(1500);

    // Expand the first evidence card (it has a chevron / cursor-pointer row)
    const evidenceRows = page.locator('.cursor-pointer');
    if (await evidenceRows.count() > 0) {
      await evidenceRows.first().click();
      await sleep(2000);
      // Let the expanded content settle, then collapse
      await evidenceRows.first().click();
      await sleep(1000);
    }

    // ── SCENE 11: Suggested fix
    console.log('🎥 Scene 11 — Suggested fix panel...');
    await page.locator('text=Suggested Fix').first().scrollIntoViewIfNeeded();
    await sleep(2000);
    const copyBtn = page.locator('text=Copy Code');
    if (await copyBtn.count() > 0) {
      await copyBtn.first().click();
      await sleep(1500);
      // Show the "Copied!" feedback
      await sleep(1000);
    }

    // ── SCENE 12: INSUFFICIENT_EVIDENCE demo
    console.log('🎥 Scene 12 — INSUFFICIENT_EVIDENCE case...');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1500);

    // Reset
    await page.locator('button[title="Reset workspace"]').click();
    await sleep(1500);

    // Re-load demo files
    await btn('Load Demo Bug').click();
    await sleep(2000);

    // Replace query with an unrelated one
    await textarea.fill('Why is the Kubernetes ingress controller giving a 504 Gateway Timeout on gRPC upstream at port 9092?');
    await sleep(2000);

    await btn('Analyze with Local RAG').click();
    await sleep(1000);

    try {
      await page.waitForSelector('text=INSUFFICIENT_EVIDENCE', { timeout: 20000 });
      console.log('   INSUFFICIENT_EVIDENCE shown correctly.');
      await sleep(3500);
    } catch {
      await sleep(3000);
      console.log('   (timed-out waiting for INSUFFICIENT_EVIDENCE panel)');
    }

    // ── SCENE 13: Quick preset buttons
    console.log('🎥 Scene 13 — Quick preset queries...');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1500);
    const nullPreset = page.locator('button', { hasText: 'Null / Undefined Map' });
    if (await nullPreset.count() > 0) {
      await nullPreset.click();
      await sleep(2000);
    }
    const racePreset = page.locator('button', { hasText: 'Async Race Condition' });
    if (await racePreset.count() > 0) {
      await racePreset.click();
      await sleep(2000);
    }

    // ── SCENE 14: Final clean state with demo loaded
    console.log('🎥 Scene 14 — Final clean view...');
    await page.locator('button[title="Reset workspace"]').click();
    await sleep(1000);
    await btn('Load Demo Bug').click();
    await sleep(2500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(4000);

    console.log('\n✅ All scenes recorded!\n');

  } finally {
    await context.close();
    await browser.close();
    server.kill();
  }

  // Rename latest .webm to codelens_demo.webm
  const videoFiles = fs.readdirSync(VIDEO_DIR)
    .filter(f => f.endsWith('.webm'))
    .sort((a, b) => fs.statSync(path.join(VIDEO_DIR, b)).mtimeMs - fs.statSync(path.join(VIDEO_DIR, a)).mtimeMs);

  if (videoFiles.length > 0) {
    const latest = videoFiles[0];
    const finalPath = path.join(VIDEO_DIR, 'codelens_demo.webm');
    if (latest !== 'codelens_demo.webm') {
      if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
      fs.renameSync(path.join(VIDEO_DIR, latest), finalPath);
    }
    const size = fs.statSync(finalPath).size;
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎬 VIDEO SAVED:');
    console.log(`   ${finalPath}`);
    console.log(`   Size: ${(size / (1024 * 1024)).toFixed(1)} MB`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n▶ Open in Chrome/Edge/Firefox to watch the demo.');
  } else {
    console.warn('⚠️  No .webm video file found. Check the demo/ directory manually.');
  }
}

record().catch(err => {
  console.error('Fatal error during recording:', err);
  process.exit(1);
});
