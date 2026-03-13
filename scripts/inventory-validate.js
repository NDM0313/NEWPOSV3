/**
 * Runs inventory-diagnostic and inventory-health; exits 0 only if both succeed and health has no error.
 * Use: npm run inventory-validate
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const healthPath = path.join(root, 'docs', 'inventory_health_report.json');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const c = spawn(cmd, args, { stdio: 'inherit', cwd: root });
    c.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))));
  });
}

async function main() {
  try {
    await run('npm', ['run', 'inventory-diagnostic']);
    await run('npm', ['run', 'inventory-health']);
  } catch (e) {
    console.error('[inventory-validate]', e.message);
    process.exit(1);
  }
  if (!fs.existsSync(healthPath)) {
    console.error('[inventory-validate] docs/inventory_health_report.json not found');
    process.exit(1);
  }
  const report = JSON.parse(fs.readFileSync(healthPath, 'utf8'));
  if (report.error) {
    console.error('[inventory-validate] Health report has error:', report.error);
    process.exit(1);
  }
  if (report.invalid_variations?.count > 0) {
    console.warn('[inventory-validate] Warning: invalid_variations.count =', report.invalid_variations.count);
  }
  console.log('[inventory-validate] OK — diagnostic and health completed; report has no error.');
  process.exit(0);
}

main();
