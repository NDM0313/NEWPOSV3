#!/usr/bin/env node
/** Copy ios-export-build{N}/NDM ERP.ipa → releases/erp-mobile-{versionName}-build{N}.ipa */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releasesDir = join(appRoot, 'releases');
const pbxproj = join(appRoot, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');

function readIosVersions() {
  const text = readFileSync(pbxproj, 'utf8');
  const versionName = text.match(/MARKETING_VERSION = ([^;]+);/)?.[1]?.trim().replace(/"/g, '') || 'unknown';
  const versionCode = text.match(/CURRENT_PROJECT_VERSION = (\d+);/)?.[1] || '0';
  return { versionName, versionCode };
}

const buildArg = process.argv.find((a) => a.startsWith('--build='))?.split('=')[1];
const { versionName, versionCode } = readIosVersions();
const buildNum = buildArg || versionCode;

const exportDir = join(releasesDir, `ios-export-build${buildNum}`);
const src = join(exportDir, 'NDM ERP.ipa');

if (!existsSync(src)) {
  console.warn(`[copy-release-ipa] Missing ${src}; run xcodebuild export first.`);
  process.exit(1);
}

const destName = `erp-mobile-${versionName}-build${buildNum}.ipa`;
mkdirSync(releasesDir, { recursive: true });
const dest = join(releasesDir, destName);
copyFileSync(src, dest);
console.log(`[copy-release-ipa] Copied to releases/${destName}`);
