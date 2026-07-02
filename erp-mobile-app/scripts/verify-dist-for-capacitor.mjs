#!/usr/bin/env node
/**
 * Fail release builds when dist is missing/stale or Capacitor is configured for live reload.
 * Run after vite build, before `npx cap sync android`.
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(appRoot, 'dist');
const indexPath = resolve(distDir, 'index.html');
const capConfigTs = resolve(appRoot, 'capacitor.config.ts');
const capConfigJson = resolve(appRoot, 'android', 'app', 'src', 'main', 'assets', 'capacitor.config.json');

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const prodEnv = parseEnvFile(resolve(appRoot, '.env.production'));
const isCapacitorBuild =
  process.env.VITE_TARGET === 'capacitor' || prodEnv.VITE_TARGET === 'capacitor';

function fail(msg) {
  console.error(`[verify-dist] ${msg}`);
  process.exit(1);
}

function toDistRelative(ref) {
  return ref.replace(/^(\.\/)?/, '').replace(/^\//, '');
}

if (!existsSync(indexPath)) {
  fail('dist/index.html missing — run npm run build:mobile:prod before cap sync.');
}

const html = readFileSync(indexPath, 'utf8');
const refs = [];

for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
  refs.push(m[1]);
}
for (const m of html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)) {
  refs.push(m[1]);
}

if (refs.length === 0) {
  fail('dist/index.html has no script or stylesheet references.');
}

if (isCapacitorBuild) {
  if (/src="\/assets\//.test(html) || /href="\/assets\//.test(html)) {
    fail('dist/index.html uses absolute /assets/ paths — Capacitor builds need relative ./assets/ (check vite base).');
  }
  const assetsDir = resolve(distDir, 'assets');
  if (existsSync(assetsDir)) {
    for (const name of readdirSync(assetsDir)) {
      if (!name.endsWith('.js')) continue;
      const js = readFileSync(join(assetsDir, name), 'utf8');
      if (js.includes("camera: 'denied'") && js.includes('barcodes: []')) {
        fail(`dist/assets/${name} contains mlkit-stub — set VITE_TARGET=capacitor in .env.production before native build.`);
      }
    }
  }
}

for (const ref of refs) {
  if (ref.startsWith('http://') || ref.startsWith('https://')) continue;
  const rel = toDistRelative(ref);
  const filePath = resolve(distDir, rel);
  if (!existsSync(filePath)) {
    fail(`Referenced asset missing: ${ref} (expected ${filePath})`);
  }
}

if (existsSync(capConfigTs)) {
  const src = readFileSync(capConfigTs, 'utf8');
  if (/server\s*:\s*\{[^}]*\burl\s*:/s.test(src)) {
    fail('capacitor.config.ts has server.url — remove for production APK (local dist bundle only).');
  }
}

if (existsSync(capConfigJson)) {
  try {
    const cfg = JSON.parse(readFileSync(capConfigJson, 'utf8'));
    if (cfg?.server?.url) {
      fail(`android capacitor.config.json has server.url=${cfg.server.url} — re-sync after removing live reload config.`);
    }
  } catch {
    fail('android/app/src/main/assets/capacitor.config.json is invalid JSON.');
  }
}

const assetsDir = resolve(distDir, 'assets');
let assetCount = 0;
let mainBundleBytes = 0;
if (existsSync(assetsDir)) {
  for (const name of readdirSync(assetsDir)) {
    if (name.endsWith('.map')) continue;
    assetCount += 1;
    if (/^index-.*\.js$/.test(name)) {
      mainBundleBytes = statSync(join(assetsDir, name)).size;
    }
  }
}

if (isCapacitorBuild && assetCount > 10) {
  console.warn(
    `[verify-dist] WARN: ${assetCount} dist/assets files — expected fewer with inlineDynamicImports (Capacitor single bundle).`,
  );
}

console.log(
  `[verify-dist] OK — ${refs.length} index refs, ${assetCount} dist/assets files` +
    (mainBundleBytes ? `, main bundle ${(mainBundleBytes / 1024 / 1024).toFixed(2)} MB` : '') +
    '.',
);
