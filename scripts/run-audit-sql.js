/**
 * Run accounting audit SQL files (read-only). Uses DATABASE_URL / DATABASE_POOLER_URL.
 * Usage: node scripts/run-audit-sql.js
 * Requires: .env.local with DATABASE_URL or DATABASE_POOLER_URL (or DATABASE_ADMIN_URL).
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const auditDir = path.join(root, 'docs', 'audit');

const COMPANY_ID = 'eb71d817-b87e-4195-964b-7b5321b480f5';

function loadEnvLocal() {
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/\\"/g, '"');
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1).replace(/\\'/g, "'");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const connectionString =
  process.env.DATABASE_ADMIN_URL ||
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL;

if (!connectionString) {
  console.error('No DATABASE_URL / DATABASE_POOLER_URL / DATABASE_ADMIN_URL in .env.local');
  process.exit(1);
}

/** Strip leading comment/section lines (-- ... or N) ...) from a segment */
function stripCommentLines(segment) {
  const lines = segment.split('\n');
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t.startsWith('--') || /^\d+\)\s/.test(t) || /^\d+[a-z]\)\s/i.test(t)) {
      i++;
      continue;
    }
    break;
  }
  return lines.slice(i).join('\n').trim();
}

/** Split SQL into statements: by ; then newline then -- (section header); each segment may have leading -- lines */
function splitStatements(sql) {
  const statements = [];
  const re = /;\s*\n\s*--/g;
  let prevEnd = 0;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const segment = sql.slice(prevEnd, m.index + 1);
    const stmt = stripCommentLines(segment);
    if (stmt) statements.push(stmt);
    prevEnd = m.index + m[0].length;
  }
  const last = stripCommentLines(sql.slice(prevEnd));
  if (last) statements.push(last);
  return statements;
}

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log('Company:', COMPANY_ID);
    console.log('');

    if (!fs.existsSync(auditDir)) {
      console.error('Audit dir not found:', auditDir);
      process.exit(1);
    }

    const files = [
      'chart_of_accounts_audit.sql',
      'report_source_reconciliation.sql',
      'payment_reference_sequence_audit.sql',
      'accounting_overlap_inventory.sql',
    ];

    for (const file of files) {
      const filePath = path.join(auditDir, file);
      if (!fs.existsSync(filePath)) {
        console.log('[SKIP]', file, '(file not found)');
        continue;
      }
      const sql = fs.readFileSync(filePath, 'utf8');
      const statements = splitStatements(sql);
      if (statements.length === 0) {
        console.log('[RUN]', file, '(no statements)');
        continue;
      }
      console.log('==========', file, '==========');
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        const preview = stmt.slice(0, 60).replace(/\s+/g, ' ') + (stmt.length > 60 ? '...' : '');
        try {
          const res = await client.query(stmt);
          if (res.rows && res.rows.length > 0) {
            console.log('Result', i + 1, ':', res.rows.length, 'row(s)');
            console.table(res.rows.slice(0, 20));
            if (res.rows.length > 20) console.log('... and', res.rows.length - 20, 'more');
          } else if (res.command) {
            console.log('Result', i + 1, ':', res.command, res.rowCount ?? 0, 'rows');
          } else {
            console.log('Result', i + 1, ':', 'OK');
          }
        } catch (err) {
          const msg = err.message || '';
          if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('undefined_table')) {
            console.log('Result', i + 1, ':', '[SKIP]', msg.split('\n')[0]);
          } else {
            console.log('Result', i + 1, ':', '[ERROR]', msg.split('\n')[0]);
          }
        }
      }
      console.log('');
    }

    console.log('Audit SQL run complete.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
