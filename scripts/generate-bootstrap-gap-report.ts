import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildModuleGapMatrixMarkdown } from '../src/app/config/companyBootstrapGapReport.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'docs/COMPANY_BOOTSTRAP_GAP_MATRIX.md');
fs.writeFileSync(outPath, buildModuleGapMatrixMarkdown(), 'utf8');
console.log('Wrote', outPath);
