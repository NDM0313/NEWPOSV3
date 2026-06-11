/**
 * Capture report print pagination acceptance screenshots (page 1 + page 2).
 * Run: node scripts/capture-report-print-pagination-screenshots.mjs
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const fixturePath = path.join(
  root,
  'docs/screenshots/report-print-pagination/fixtures/ledger-print-multipage.html',
);
const outDir = path.join(root, 'docs/screenshots/report-print-pagination');

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

const fileUrl = `file:///${fixturePath.replace(/\\/g, '/')}`;
await page.goto(fileUrl, { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });

const pdfBuffer = await page.pdf({
  format: 'A4',
  printBackground: true,
  margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
});

const pdfPath = path.join(outDir, 'ledger-print-multipage.pdf');
fs.writeFileSync(pdfPath, pdfBuffer);

const pageCount = (pdfBuffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
console.log(`PDF pages: ${pageCount} (saved ${pdfPath})`);

if (pageCount < 2) {
  console.warn('Warning: expected at least 2 pages for pagination acceptance');
}

const pdfBase64 = pdfBuffer.toString('base64');

const pngDataUrls = await page.evaluate(async (b64) => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

  // eslint-disable-next-line no-undef
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  // eslint-disable-next-line no-undef
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const urls = [];
  const scale = 2;
  for (let p = 1; p <= Math.min(2, pdf.numPages); p++) {
    const pdfPage = await pdf.getPage(p);
    const viewport = pdfPage.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await pdfPage.render({ canvasContext: ctx, viewport }).promise;
    urls.push(canvas.toDataURL('image/png'));
  }
  return { urls, numPages: pdf.numPages };
}, pdfBase64);

for (let i = 0; i < pngDataUrls.urls.length; i++) {
  const outPath = path.join(outDir, `page-${i + 1}.png`);
  const data = pngDataUrls.urls[i].replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
  console.log('Wrote', outPath);
}

console.log(`Done — ${pngDataUrls.numPages} PDF page(s), captured ${pngDataUrls.urls.length} screenshot(s).`);
await browser.close();
