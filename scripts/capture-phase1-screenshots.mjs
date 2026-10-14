/**
 * Capture Phase 1 acceptance screenshots from HTML fixtures.
 * Run: node scripts/capture-phase1-screenshots.mjs
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const fixtureDir = path.join(root, 'docs/screenshots/phase1-acceptance/fixtures');
const outDir = path.join(root, 'docs/screenshots/phase1-acceptance');

const shots = [
  { html: 'ledger-v2-pdf-preview.html', png: 'ledger-v2-pdf-preview-8-columns.png', width: 900, height: 720 },
  { html: 'ledger-v2-csv-export.html', png: 'ledger-v2-csv-export-sample.png', width: 1000, height: 420 },
  { html: 'ledger-v2-loading-overlay.html', png: 'ledger-v2-row-loading-overlay.png', width: 900, height: 560 },
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
console.log('Done — 3 acceptance screenshots captured.');
