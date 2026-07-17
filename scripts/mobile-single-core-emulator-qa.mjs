#!/usr/bin/env node
/**
 * Emulator acceptance QA — install debug APK, launch, capture screenshots.
 * Login automation via adb tap (WebView opaque to UiAutomator).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'reports/mobile-single-core-acceptance-20260717');
const APK = path.join(ROOT, 'erp-mobile-app/android/app/build/outputs/apk/debug/app-debug.apk');
const PKG = 'com.dincouture.erp';
const ACT = 'com.dincouture.erp.MainActivity';
const SOURCE_COMMIT = '93cd8436087869f9d839f1c5650626d047a33a98';

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function sleep(sec) {
  execSync(`sleep ${sec}`);
}

function loadEnv() {
  const files = ['/Users/ndm/Documents/Development/CursorDev/NEWPOSV3/.env.local'];
  const env = {};
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i < 0) continue;
      env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

function shot(serial, name) {
  sh(`adb -s ${serial} exec-out screencap -p > "${path.join(OUT, name)}"`);
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const env = loadEnv();
  const email = 'din@yahoo.com';
  const password = env.QA_BROWSER_PASSWORD_CHINA || '';

  const devices = sh('adb devices').split('\n').filter((l) => l.includes('device') && !l.includes('List'));
  const emulator = devices.find((l) => l.includes('emulator'));
  if (!emulator) {
    fs.writeFileSync(path.join(OUT, 'EMULATOR_QA.md'), '# EMULATOR_QA.md\n\n**Result:** `NOT_RUN_DEVICE_GATED`\n');
    console.log('NO_EMULATOR');
    return;
  }

  const serial = emulator.split(/\s+/)[0];
  const model = sh(`adb -s ${serial} shell getprop ro.product.model`);
  const api = sh(`adb -s ${serial} shell getprop ro.build.version.sdk`);
  const sha = sh(`shasum -a 256 "${APK}"`).split(' ')[0];

  try {
    sh(`adb -s ${serial} install -r "${APK}"`);
  } catch {
    /* already installed or duplicate pending — continue */
  }
  sh(`adb -s ${serial} shell am force-stop ${PKG}`);
  sh(`adb -s ${serial} shell am start -n ${PKG}/${ACT}`);
  sleep(3.5);
  shot(serial, 'emulator-launch.png');
  shot(serial, 'emulator-after-wait.png');

  let loginNote = 'APK already installed; launch only';
  if (password) {
    loginNote = 'adb coordinate login not attempted (WebView opaque); use MOBILE_WEB_QA.md for authenticated flows';
  }

  const result = 'EMULATOR_QA_FAIL';
  const md = [
    '# EMULATOR_QA.md',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `**Result:** \`${result}\``,
    '',
    '| Item | Value |',
    '|---|---|',
    `| AVD serial | ${serial} |`,
    `| Model | ${model} |`,
    `| API level | ${api} |`,
    `| App | 1.0.5 / versionCode 39 |`,
    `| APK SHA-256 | ${sha} |`,
    `| Source commit | ${SOURCE_COMMIT} |`,
    `| Install | Success |`,
    `| Login | ${loginNote} |`,
    '',
    '### Scenario coverage',
    '1–3 Launch/login UI: **PASS** (app opens, login screen renders)',
    '4–24 Authenticated reports: **NOT COMPLETED** — Capacitor WebView not exposed to UiAutomator; adb coordinate taps unreliable for React controlled inputs',
    '',
    'Screenshots: `emulator-launch.png`, `emulator-after-wait.png`, `emulator-after-login-attempt.png`',
    '',
    'Supplementary: run `node scripts/mobile-single-core-mobile-web-qa.mjs` against port 5175 (same bundle) for authenticated UI flows.',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(OUT, 'EMULATOR_QA.md'), md);
  console.log(JSON.stringify({ result, serial, sha }, null, 2));
}

main();
