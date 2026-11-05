#!/usr/bin/env node
/**
 * Auto-resolve git conflict markers in erp-mobile-app (and repo root docs/scripts).
 *
 * Policy (pull merge: HEAD = local Mac, incoming = origin/main):
 * - supabase / API URL resolvers: prefer remote HTTPS + staging + session purge;
 *   keep local session-guard / error-message blocks when they don't conflict with URLs.
 * - UI (App, Login, LeadTools, ConnectionDebug): keep local UI/pasteboard/filters;
 *   ensure remote StagingEnvBanner / [STAGING DB] wiring remains.
 * - package.json / capacitor / badge / staging env example / vite: prefer remote staging
 *   scripts, union package.json script keys when both are JSON-ish.
 * - Default: union both sides (remote then local unique lines).
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
process.chdir(REPO);

function listConflictedFiles() {
  const out = execSync('git diff --name-only --diff-filter=U', { encoding: 'utf8' });
  const fromGit = out.split('\n').map((s) => s.trim()).filter(Boolean);
  if (fromGit.length) return fromGit;
  // Also scan working tree for leftover markers
  const scan = execSync(
    "git grep -l '<<<<<<<' -- ':!node_modules' ':!dist' ':!**/.git/**' || true",
    { encoding: 'utf8' },
  );
  return scan.split('\n').map((s) => s.trim()).filter(Boolean);
}

function classify(file) {
  const f = file.replace(/\\/g, '/');
  if (/supabase\.ts$|resolveSupabaseApiUrl\.ts$|authPasswordGrant\.ts$|authSessionRecovery\.ts$/i.test(f)) {
    return 'api';
  }
  if (/App\.tsx$|LoginScreen\.tsx$|LeadToolsSection\.tsx$|ConnectionDebug\.tsx$|SalesHome\.tsx$|SalesListFilterSheet\.tsx$/i.test(f)) {
    return 'ui';
  }
  if (/package\.json$|capacitor\.config\.ts$|vite\.config\.ts$|\.env\.example$|\.env\.staging\.example$|badge-ios-stage|mac-merge|ios:prep|CAPACITOR\.md|README_BUILD\.md/i.test(f)) {
    return 'config';
  }
  return 'default';
}

function stripMarkers(text) {
  return text
    .replace(/^<<<<<<<.*\n/gm, '')
    .replace(/^>>>>>>>.+\n/gm, '')
    .replace(/^=======\n/gm, '');
}

/** Parse conflict regions into { before, ours, theirs, after } chunks. */
function parseConflicts(text) {
  const lines = text.split(/\n/);
  const parts = [];
  let i = 0;
  let buf = [];
  while (i < lines.length) {
    if (lines[i].startsWith('<<<<<<<')) {
      parts.push({ type: 'text', lines: buf });
      buf = [];
      i += 1;
      const ours = [];
      while (i < lines.length && !lines[i].startsWith('=======')) {
        ours.push(lines[i]);
        i += 1;
      }
      if (i < lines.length && lines[i].startsWith('=======')) i += 1;
      const theirs = [];
      while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
        theirs.push(lines[i]);
        i += 1;
      }
      if (i < lines.length && lines[i].startsWith('>>>>>>>')) i += 1;
      parts.push({ type: 'conflict', ours, theirs });
    } else {
      buf.push(lines[i]);
      i += 1;
    }
  }
  if (buf.length) parts.push({ type: 'text', lines: buf });
  return parts;
}

function unionLines(primary, secondary) {
  const seen = new Set();
  const out = [];
  for (const line of [...primary, ...secondary]) {
    const key = line.trimEnd();
    if (seen.has(key) && key.trim() !== '') continue;
    // Always keep blank lines once in sequence
    if (key.trim() === '') {
      if (out.length && out[out.length - 1].trim() === '') continue;
      out.push('');
      continue;
    }
    seen.add(key);
    out.push(line);
  }
  return out;
}

function preferRemoteHttps(ours, theirs) {
  const joinedTheirs = theirs.join('\n');
  const joinedOurs = ours.join('\n');
  const remoteHasHttps =
    /api\.ndmcore\.com|api-stage\.ndmcore\.com|purgeStaleAuthStorage|isInsecureLanApiUrl|STAGING_API|NDMCORE_API/.test(
      joinedTheirs,
    );
  const localHasLan = /192\.168\.86\.235|http:\/\/192\.168/.test(joinedOurs);
  if (remoteHasHttps || localHasLan) {
    // Remote first, then local-only guard/error lines not already present
    return unionLines(theirs, ours);
  }
  return unionLines(ours, theirs);
}

function preferLocalUiKeepStagingBanner(ours, theirs) {
  const remoteBanner =
    /StagingEnvBanner|isStagingMobileBuild|\[STAGING DB\]|erp-staging-banner|VITE_APP_ENV/.test(
      theirs.join('\n'),
    );
  const merged = unionLines(ours, theirs);
  if (remoteBanner && !/StagingEnvBanner|\[STAGING DB\]/.test(merged.join('\n'))) {
    return unionLines(theirs, ours);
  }
  return merged;
}

function preferConfigUnion(ours, theirs) {
  // Prefer remote staging scripts / capacitor stage identity, keep local extras
  return unionLines(theirs, ours);
}

function resolveFile(file, text) {
  const kind = classify(file);
  if (!text.includes('<<<<<<<')) return { text, changed: false };

  const parts = parseConflicts(text);
  const out = [];
  for (const p of parts) {
    if (p.type === 'text') {
      out.push(...p.lines);
      continue;
    }
    let chosen;
    if (kind === 'api') chosen = preferRemoteHttps(p.ours, p.theirs);
    else if (kind === 'ui') chosen = preferLocalUiKeepStagingBanner(p.ours, p.theirs);
    else if (kind === 'config') chosen = preferConfigUnion(p.ours, p.theirs);
    else chosen = unionLines(p.theirs, p.ours);
    out.push(...chosen);
  }
  let resolved = out.join('\n');
  // Safety: no markers left
  if (/^<<<<<<<|^=======|^>>>>>>>/m.test(resolved)) {
    resolved = stripMarkers(resolved);
  }
  return { text: resolved, changed: true, kind };
}

function ensureStagingUiImports(file, text) {
  if (!/App\.tsx$/.test(file.replace(/\\/g, '/'))) return text;
  if (/StagingEnvBanner/.test(text)) return text;
  // If banner usage missing entirely after merge, inject import + first render hook is too risky;
  // origin/main already has it — prefer re-reading theirs via git show if available.
  try {
    const theirs = execSync(`git show :3:${file}`, { encoding: 'utf8' });
    if (/StagingEnvBanner/.test(theirs) && !/StagingEnvBanner/.test(text)) {
      return theirs; // take full remote App.tsx if local lost staging banner
    }
  } catch {
    /* stage not available */
  }
  return text;
}

const files = listConflictedFiles();
if (!files.length) {
  console.log('No conflicted files or conflict markers found.');
  process.exit(0);
}

console.log(`Resolving ${files.length} conflicted file(s)...`);
const resolvedPaths = [];
for (const file of files) {
  const abs = path.join(REPO, file);
  if (!fs.existsSync(abs)) {
    console.warn(` skip missing ${file}`);
    continue;
  }
  const before = fs.readFileSync(abs, 'utf8');
  let { text, changed, kind } = resolveFile(file, before);
  text = ensureStagingUiImports(file, text);
  if (changed || text !== before) {
    fs.writeFileSync(abs, text.endsWith('\n') ? text : `${text}\n`);
    execSync(`git add -- "${file.replace(/"/g, '\\"')}"`);
    resolvedPaths.push(`${file} (${kind || classify(file)})`);
    console.log(` ✓ ${file}`);
  } else {
    console.log(` · ${file} (no markers)`);
  }
}

const leftover = execSync(
  "git grep -l '<<<<<<<' -- ':!node_modules' ':!dist' || true",
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean);
if (leftover.length) {
  console.error('Unresolved markers remain in:', leftover.join(', '));
  process.exit(1);
}

console.log(`Done. Resolved: ${resolvedPaths.length}`);
for (const p of resolvedPaths) console.log(`  - ${p}`);
