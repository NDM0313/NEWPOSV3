#!/usr/bin/env node
/**
 * Sync Supabase env from project root to erp-mobile-app so Web + Mobile use same backend (same data).
 * Run from project root: node scripts/sync-mobile-env.js
 * Or: npm run sync:mobile-env
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const mobileEnvPath = path.join(rootDir, 'erp-mobile-app', '.env');

const envFiles = ['.env.local', '.env.production', '.env'];
let url = '';
let key = '';

for (const name of envFiles) {
  const p = path.join(rootDir, name);
  if (!fs.existsSync(p)) continue;
  const content = fs.readFileSync(p, 'utf8');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (t.startsWith('VITE_SUPABASE_URL=')) {
      url = t.slice('VITE_SUPABASE_URL='.length).replace(/^["']|["']$/g, '').trim();
    } else if (t.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      key = t.slice('VITE_SUPABASE_ANON_KEY='.length).replace(/^["']|["']$/g, '').trim();
    }
  }
  if (url && key) break;
}

if (!url || !key) {
  console.warn('[sync-mobile-env] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not found in .env.local / .env.production / .env. Skipping.');
  process.exit(0);
}

// erp.dincouture.pk proxy returns 308/"auth" → "Unexpected token '/', \"/auth\" is not valid JSON"
// Use supabase.dincouture.pk directly for auth (works reliably)
if (url.includes('erp.dincouture.pk')) {
  url = url.replace(/https?:\/\/erp\.dincouture\.pk\/?/i, 'https://supabase.dincouture.pk');
  console.log('[sync-mobile-env] Replaced erp.dincouture.pk with supabase.dincouture.pk (auth proxy returns invalid JSON)');
}

const out = `# Auto-synced from project root – same backend as Web ERP (run: npm run sync:mobile-env)
VITE_SUPABASE_URL=${url}
VITE_SUPABASE_ANON_KEY=${key}
`;

fs.writeFileSync(mobileEnvPath, out, 'utf8');
console.log('[sync-mobile-env] Updated erp-mobile-app/.env with VITE_SUPABASE_* from root. Restart mobile dev server if running.');
