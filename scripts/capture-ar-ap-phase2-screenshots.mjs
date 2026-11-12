/**
 * Capture Phase 2 AR/AP Reconciliation Center UI screenshots from HTML fixtures.
 * Fixtures mirror live Phase 2 modals using Phase 1 audit sample data (SL-0005, RCV-0017).
 *
 * Run: node scripts/capture-ar-ap-phase2-screenshots.mjs
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const fixtureDir = path.join(root, 'docs/screenshots/ar-ap-phase2/fixtures');
const outDir = path.join(root, 'docs/screenshots/ar-ap-phase2');

const shots = [
  {
    html: 'phase2-source-document-modal.html',
    png: 'phase2-source-modal.png',
    width: 920,
    height: 780,
  },
  {
    html: 'phase2-posting-dryrun-wizard.html',
    png: 'phase2-posting-dryrun.png',
    width: 960,
    height: 620,
  },
  {
    html: 'phase2-relink-dryrun-wizard.html',
    png: 'phase2-relink-dryrun.png',
    width: 920,
    height: 860,
  },
  {
    html: 'phase2-row-trace-panel.html',
    png: 'phase2-row-trace.png',
    width: 1100,
    height: 720,
  },
];

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

for (const { html, png, width, height } of shots) {
  const filePath = path.join(fixtureDir, html);
  const outPath = path.join(outDir, png);
  await page.setViewportSize({ width, height });
  await page.goto(`file:///${filePath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: outPath, fullPage: false });
  console.log('Wrote', outPath);
}

await browser.close();
console.log('Done — 4 Phase 2 AR/AP screenshots captured.');
