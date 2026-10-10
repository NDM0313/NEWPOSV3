#!/usr/bin/env node
/**
 * Upload legacy AccountTransaction media → payment-attachments,
 * then set journal_entries.attachments for imported ZHD journals.
 *
 * Usage:
 *   node migration-tools/importZhdCashbookAttachments.js --dry-run --target-company-id <uuid>
 *   node migration-tools/importZhdCashbookAttachments.js --confirm --target-company-id <uuid>
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { legacyToUuid } from './lib/legacyId.js';
import { loadMigrationEnv } from './lib/loadMigrationEnv.js';
import { TOOLS_ROOT } from './lib/resolvePaths.js';

const NS_JE = 'zhd_cashbook_je';
const BUCKET = 'payment-attachments';
const COMPANY_DEFAULT = 'e08a04af-22a8-4869-9b4d-da31fce13158';
const MEDIA_DIRS = [
  'c:\\xampp\\htdocs\\a8\\public\\uploads\\media',
  'c:\\xampp\\htdocs\\SHOPA8\\public\\uploads\\media',
];

function uuidJe(key) {
  return legacyToUuid(NS_JE, key);
}

function mimeFor(name) {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}

function storageRef(bucket, objectPath) {
  return `${bucket}/${objectPath}`;
}

function mysqlJson(sql) {
  const res = spawnSync(
    'c:\\xampp\\mysql\\bin\\mysql.exe',
    ['-u', 'root', '--batch', '--raw', '--skip-column-names', '-e', sql],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  if (res.status !== 0) {
    throw new Error(res.stderr || res.stdout || 'mysql failed');
  }
  return res.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function findLocalFile(fileName) {
  for (const dir of MEDIA_DIRS) {
    const p = path.join(dir, fileName);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadTxnPartnerMap() {
  const txnPath = path.join(TOOLS_ROOT, 'output', 'zhd_account_transactions.json');
  const raw = fs.readFileSync(txnPath, 'utf8').replace(/^\uFEFF/, '');
  const txns = JSON.parse(raw);
  const byId = new Map(txns.map((t) => [Number(t.id), t]));
  /** @type {Map<number, string>} txnId -> journal uuid */
  const txnToJe = new Map();

  for (const t of txns) {
    const id = Number(t.id);
    const sub = t.sub_type == null ? null : String(t.sub_type).toLowerCase();
    if (sub === 'opening_balance') {
      txnToJe.set(id, uuidJe(`ob:${id}`));
      continue;
    }
    const partner = Number(t.transfer_transaction_id) || 0;
    if (partner > 0) {
      const a = Math.min(id, partner);
      const b = Math.max(id, partner);
      txnToJe.set(id, uuidJe(`pair:${a}:${b}`));
    }
  }
  return { byId, txnToJe };
}

async function main() {
  const argv = process.argv.slice(2);
  const env = loadMigrationEnv(argv);
  const companyId = env.targetCompanyId || COMPANY_DEFAULT;

  console.log('Loading media rows from zhd_ready...');
  const mediaRows = mysqlJson(`
SELECT JSON_OBJECT(
  'media_id', m.id,
  'file_name', m.file_name,
  'model_id', m.model_id,
  'created_at', DATE_FORMAT(m.created_at, '%Y-%m-%d %H:%i:%s')
)
FROM zhd_ready.media m
INNER JOIN zhd_ready.account_transactions at
  ON at.id = m.model_id AND at.deleted_at IS NULL
WHERE m.model_type = 'App\\\\AccountTransaction'
ORDER BY m.id;
`);
  console.log(`Media rows linked to ready txns: ${mediaRows.length}`);

  const { txnToJe } = loadTxnPartnerMap();

  /** @type {Map<string, { url: string, name: string, localPath: string, mediaId: number, storagePath: string }[]>} */
  const byJe = new Map();
  const stats = {
    media: mediaRows.length,
    missingFile: 0,
    noJournal: 0,
    plannedUploads: 0,
    uploaded: 0,
    uploadFailed: 0,
    journalsUpdated: 0,
  };

  for (const m of mediaRows) {
    const txnId = Number(m.model_id);
    const jeId = txnToJe.get(txnId);
    if (!jeId) {
      stats.noJournal += 1;
      continue;
    }
    const localPath = findLocalFile(String(m.file_name));
    if (!localPath) {
      stats.missingFile += 1;
      console.warn(`Missing file: ${m.file_name} (media #${m.media_id})`);
      continue;
    }
    const safeName = String(m.file_name).replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${companyId}/zhd-import/${m.media_id}_${safeName}`;
    const att = {
      url: storageRef(BUCKET, storagePath),
      name: String(m.file_name),
      localPath,
      mediaId: Number(m.media_id),
      storagePath,
    };
    if (!byJe.has(jeId)) byJe.set(jeId, []);
    // dedupe same media id
    if (!byJe.get(jeId).some((x) => x.mediaId === att.mediaId)) {
      byJe.get(jeId).push(att);
      stats.plannedUploads += 1;
    }
  }

  const report = {
    companyId,
    dryRun: env.dryRun,
    journalsWithAttachments: byJe.size,
    ...stats,
  };
  fs.writeFileSync(
    path.join(TOOLS_ROOT, 'output', 'zhd_attachment_import_report.json'),
    JSON.stringify(
      {
        ...report,
        sample: [...byJe.entries()].slice(0, 3).map(([je, atts]) => ({
          journalId: je,
          files: atts.map((a) => a.name),
        })),
      },
      null,
      2
    )
  );
  console.log(JSON.stringify(report, null, 2));

  if (env.dryRun) {
    console.log('Dry-run only — no uploads.');
    return;
  }

  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Upload unique files
  const uploads = new Map(); // storagePath -> att
  for (const atts of byJe.values()) {
    for (const a of atts) uploads.set(a.storagePath, a);
  }

  let i = 0;
  for (const att of uploads.values()) {
    i += 1;
    const buf = fs.readFileSync(att.localPath);
    const { error } = await supabase.storage.from(BUCKET).upload(att.storagePath, buf, {
      upsert: true,
      contentType: mimeFor(att.name),
    });
    if (error) {
      stats.uploadFailed += 1;
      console.error(`[upload] ${att.name}: ${error.message}`);
    } else {
      stats.uploaded += 1;
    }
    if (i % 25 === 0) console.log(`[upload] ${i}/${uploads.size}`);
  }
  console.log(`[upload] done ${stats.uploaded}/${uploads.size} (failed ${stats.uploadFailed})`);

  // Patch journal attachments
  let j = 0;
  for (const [jeId, atts] of byJe.entries()) {
    j += 1;
    const payload = atts.map((a) => ({ url: a.url, name: a.name }));
    // merge with any existing
    const { data: existing, error: readErr } = await supabase
      .from('journal_entries')
      .select('id, attachments')
      .eq('id', jeId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (readErr) {
      console.error(`[je read] ${jeId}: ${readErr.message}`);
      continue;
    }
    if (!existing) {
      // journal may have been skipped (skip-side pairs)
      continue;
    }
    const prev = Array.isArray(existing.attachments) ? existing.attachments : [];
    const byUrl = new Map();
    for (const p of prev) {
      if (p?.url) byUrl.set(String(p.url), { url: p.url, name: p.name || 'file' });
    }
    for (const p of payload) byUrl.set(p.url, p);
    const merged = [...byUrl.values()];
    const { error: upErr } = await supabase
      .from('journal_entries')
      .update({ attachments: merged })
      .eq('id', jeId)
      .eq('company_id', companyId);
    if (upErr) console.error(`[je update] ${jeId}: ${upErr.message}`);
    else stats.journalsUpdated += 1;
    if (j % 50 === 0) console.log(`[je attach] ${j}/${byJe.size}`);
  }

  const finalReport = { ...report, ...stats, dryRun: false };
  fs.writeFileSync(
    path.join(TOOLS_ROOT, 'output', 'zhd_attachment_import_report.json'),
    JSON.stringify(finalReport, null, 2)
  );
  console.log(JSON.stringify(finalReport, null, 2));
  console.log('Attachment import complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
