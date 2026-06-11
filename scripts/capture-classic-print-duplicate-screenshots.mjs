/**
 * Capture classic/thermal print duplicate-fix acceptance screenshots.
 * Run: node scripts/capture-classic-print-duplicate-screenshots.mjs
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const fixtureDir = path.join(root, 'docs/screenshots/classic-print-duplicate/fixtures');
const outDir = path.join(root, 'docs/screenshots/classic-print-duplicate');

const shots = [
  {
    html: 'invoice-a4-single-page.html',
    png: 'page-1-a4.png',
    emulateThermal: false,
    pageSize: 'A4',
  },
  {
    html: 'invoice-thermal-single-page.html',
    png: 'page-1-thermal.png',
    emulateThermal: true,
    pageSize: { width: '58mm', height: 'auto' },
  },
];

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

for (const { html, png, emulateThermal, pageSize } of shots) {
  const page = await browser.newPage();
  const filePath = path.join(fixtureDir, html);
  await page.goto(`file:///${filePath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });

  if (emulateThermal) {
    await page.emulateMedia({ media: 'print' });
  } else {
    await page.emulateMedia({ media: 'print' });
  }

  const pdfOpts =
    pageSize === 'A4'
      ? { format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } }
      : { width: '58mm', printBackground: true, margin: { top: '1mm', bottom: '1mm', left: '1mm', right: '1mm' } };

  const pdfBuffer = await page.pdf(pdfOpts);
  const pageCount = (pdfBuffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`${html}: PDF pages = ${pageCount}${pageCount === 1 ? ' (OK)' : ' (WARN: expected 1)'}`);

  const pdfBase64 = pdfBuffer.toString('base64');
  const dataUrl = await page.evaluate(async (b64) => {
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
    const pdfPage = await pdf.getPage(1);
    const viewport = pdfPage.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await pdfPage.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/png');
  }, pdfBase64);

  const outPath = path.join(outDir, png);
  const data = dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
  console.log('Wrote', outPath);
  await page.close();
}

await browser.close();
console.log('Done — classic print duplicate-fix screenshots captured.');
