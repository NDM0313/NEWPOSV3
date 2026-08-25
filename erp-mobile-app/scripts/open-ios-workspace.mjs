#!/usr/bin/env node
/** Open App.xcworkspace; warn if CocoaPods were never installed. */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = join(appRoot, 'ios', 'App', 'Pods', 'Manifest.lock');
const workspace = join(appRoot, 'ios', 'App', 'App.xcworkspace');

if (!existsSync(manifest)) {
  console.warn('[cap:ios] Pods not installed — run: npm run ios:prep:mac');
  console.warn('[cap:ios] Never open App.xcodeproj alone (Search path Capacitor not found).');
}

if (!existsSync(workspace)) {
  console.error(`[cap:ios] Missing ${workspace}`);
  process.exit(1);
}

execSync(`open "${workspace}"`, { stdio: 'inherit' });
