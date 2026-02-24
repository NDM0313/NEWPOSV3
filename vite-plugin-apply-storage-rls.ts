/**
 * Dev-only: POST /__apply_storage_rls runs npm run apply-storage-rls so the app can auto-apply storage RLS.
 */
import type { Plugin } from 'vite';
import { spawn } from 'child_process';
import path from 'path';

const APPLY_RLS_PATH = '/__apply_storage_rls';

export function applyStorageRlsPlugin(): Plugin {
  return {
    name: 'apply-storage-rls',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== APPLY_RLS_PATH || req.method !== 'POST') {
          next();
          return;
        }
        const root = path.resolve(process.cwd());
        const scriptPath = path.join(root, 'scripts', 'apply-storage-rls.js');
        const child = spawn('node', [scriptPath], {
          cwd: root,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env },
        });
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (d) => { stdout += d.toString(); });
        child.stderr?.on('data', (d) => { stderr += d.toString(); });
        child.on('close', (code) => {
          res.setHeader('Content-Type', 'application/json');
          if (code === 0) {
            res.end(JSON.stringify({ ok: true, message: stdout.trim() || 'Storage RLS applied.' }));
          } else {
            res.end(JSON.stringify({ ok: false, error: (stderr || stdout).trim() || `Exit code ${code}` }));
          }
        });
        child.on('error', (err) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: err.message }));
        });
      });
    },
  };
}
