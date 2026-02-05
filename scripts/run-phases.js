/**
 * Run Phase 4 (seed) then Phase 5 (validate).
 * Usage: node scripts/run-phases.js
 * Requires: DATABASE_POOLER_URL or DATABASE_URL in .env.local
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function run(name, script) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [path.join(root, 'scripts', script)], {
      cwd: root,
      stdio: 'inherit',
      shell: true,
    });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${name} exited with ${code}`))));
    child.on('error', reject);
  });
}

async function main() {
  console.log('Phase 4 – Running seed...\n');
  await run('Seed', 'run-seed.js');
  console.log('\nPhase 5 – Running validation...\n');
  await run('Validate', 'validate-seed.js');
  console.log('\nAll phases complete.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
