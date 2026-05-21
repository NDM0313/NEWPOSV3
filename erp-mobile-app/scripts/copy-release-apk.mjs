#!/usr/bin/env node
/** Copy app-release.apk → releases/erp-mobile-{versionName}-build{versionCode}.apk */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = join(appRoot, 'android', 'app', 'build', 'outputs', 'apk', 'release');
const releasesDir = join(appRoot, 'releases');

if (!existsSync(releaseDir)) {
  console.warn('[copy-release-apk] No release output folder; skip copy.');
  process.exit(0);
}

const apk = readdirSync(releaseDir).find((f) => f.endsWith('.apk'));
if (!apk) {
  console.warn('[copy-release-apk] No .apk in release folder; skip copy.');
  process.exit(0);
}

const gradle = readFileSync(join(appRoot, 'android', 'app', 'build.gradle'), 'utf8');
const versionName = gradle.match(/versionName\s+"([^"]+)"/)?.[1] || 'unknown';
const versionCode = gradle.match(/versionCode\s+(\d+)/)?.[1] || '0';
const destName = `erp-mobile-${versionName}-build${versionCode}.apk`;
mkdirSync(releasesDir, { recursive: true });
const dest = join(releasesDir, destName);
copyFileSync(join(releaseDir, apk), dest);
console.log(`[copy-release-apk] Copied to releases/${destName}`);
