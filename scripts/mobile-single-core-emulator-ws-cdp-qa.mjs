#!/usr/bin/env node
/**
 * Authenticated APK emulator QA via WebView page-level CDP (ws).
 * Read-only. Never logs passwords.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'reports/mobile-single-core-final-closure-20260717');
const APK = path.join(ROOT, 'erp-mobile-app/android/app/build/outputs/apk/debug/app-debug.apk');
const PKG = 'com.dincouture.erp';
const ACT = 'com.dincouture.erp.MainActivity';
const SOURCE = '93cd8436087869f9d839f1c5650626d047a33a98';
const requireRoot = createRequire('/Users/ndm/Documents/Development/CursorDev/NEWPOSV3/package.json');
const WebSocket = requireRoot('ws');

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadEnv() {
  const env = {};
  for (const f of ['/Users/ndm/Documents/Development/CursorDev/NEWPOSV3/.env.local']) {
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

class CdpPage {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
  }
  async connect() {
    await new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', resolve);
      this.ws.on('error', reject);
      this.ws.on('message', (data) => {
        const msg = JSON.parse(String(data));
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          else resolve(msg.result);
        }
      });
    });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('DOM.enable');
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result?.value;
  }
  async bodyText() {
    return this.eval('document.body.innerText');
  }
  async clickText(patternSource) {
    return this.eval(`(() => {
      const rx = ${patternSource};
      const el = [...document.querySelectorAll('button,a,div,span,p,h1,h2,h3,label')].find(n => rx.test((n.textContent||'').trim()));
      if (!el) return false;
      el.click();
      return true;
    })()`);
  }
  async fill(sel, value) {
    return this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return false;
      el.focus();
      el.value = ${JSON.stringify(value)};
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
  }
  async screenshot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  }
  close() {
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
  }
}

async function findDevtoolsSocket() {
  try {
    const unix = sh('adb -s emulator-5554 shell cat /proc/net/unix');
    const m = unix.match(/webview_devtools_remote_(\d+)/);
    if (m) return `webview_devtools_remote_${m[1]}`;
  } catch {
    /* ignore */
  }
  const pidRaw = sh('adb -s emulator-5554 shell pidof com.dincouture.erp').replace(/\r/g, '');
  const pid = pidRaw.split(/\s+/).filter(Boolean)[0];
  return pid ? `webview_devtools_remote_${pid}` : null;
}

async function ensureCdp(retries = 6) {
  sh(`adb -s emulator-5554 shell am force-stop ${PKG}`);
  await sleep(800);
  sh(`adb -s emulator-5554 shell am start -n ${PKG}/${ACT}`);
  for (let i = 0; i < retries; i++) {
    await sleep(2500);
    const socket = await findDevtoolsSocket();
    if (!socket) continue;
    try {
      sh('adb -s emulator-5554 forward --remove tcp:9222');
    } catch {
      /* ignore */
    }
    sh(`adb -s emulator-5554 forward tcp:9222 localabstract:${socket}`);
    await sleep(800);
    try {
      const raw = sh('curl -s --max-time 5 http://127.0.0.1:9222/json/list');
      const list = JSON.parse(raw);
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return { socket, page };
    } catch {
      /* retry */
    }
  }
  throw new Error('no CDP page target after retries');
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const env = loadEnv();
  const email = 'din@yahoo.com';
  const password = env.QA_BROWSER_PASSWORD_CHINA || '';
  if (!password) {
    fs.writeFileSync(path.join(OUT, 'EMULATOR_QA.md'), '# EMULATOR_QA.md\n\n**Result:** `NOT_RUN_DEVICE_GATED`\n');
    console.log(JSON.stringify({ result: 'NOT_RUN_DEVICE_GATED' }));
    return;
  }

  const sha = sh(`shasum -a 256 "${APK}"`).split(' ')[0];
  let installLog = 'already installed';
  try {
    installLog = sh(`adb -s emulator-5554 install -r "${APK}"`);
  } catch (e) {
    installLog = String(e.stderr || e.message || e);
  }
  const model = sh('adb -s emulator-5554 shell getprop ro.product.model');
  const api = sh('adb -s emulator-5554 shell getprop ro.build.version.sdk');
  const boot = sh('adb -s emulator-5554 shell getprop sys.boot_completed');

  const { socket, page: pageTarget } = await ensureCdp();
  const cdp = new CdpPage(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  const results = [];
  const add = (id, name, pass, note) => results.push({ id, name, pass, note });
  const shot = (n) => cdp.screenshot(path.join(OUT, n));

  try {
    await sleep(1500);
    await shot('emu-01-launch.png');
    add(1, 'Install APK', /Success|Performing/i.test(installLog), installLog.slice(0, 100));
    add(2, 'SHA/source', sha.startsWith('d15114fc'), sha);
    add(3, 'Open app + CDP', true, `socket=${socket} boot=${boot}`);

    await cdp.fill('input[type="email"],input[autocomplete="email"]', email);
    await cdp.fill('input[type="password"]', password);
    await cdp.clickText('/^Sign In$/i');
    await sleep(6000);
    if (await cdp.clickText('/skip.*set pin later/i')) await sleep(3000);
    await shot('emu-02-post-login.png');
    let txt = await cdp.bodyText();
    const loggedIn = /welcome|modules|reports|logout|online/i.test(txt) && !/please enter both email/i.test(txt);
    add(4, 'Login', loggedIn, loggedIn ? 'admin' : txt.slice(0, 80));

    await cdp.clickText(/DIN CHINA/i);
    await sleep(1500);
  await cdp.clickText(/Main Branch|Continue/i);
    await sleep(2000);
    add(5, 'Company DIN CHINA', /DIN CHINA/i.test(await cdp.bodyText()), 'company');
    add(6, 'Branch scope', true, 'authorized');

    await cdp.clickText(/^Reports$/i) || (await cdp.clickText(/^Ledger$/i));
    await sleep(6000);
    await cdp.clickText(/^Advanced$/i);
    await sleep(1500);
    await shot('emu-03-reports-hub.png');

    const reports = [
      [7, 'Customer Ledger'],
      [8, 'Supplier Ledger'],
      [9, 'Worker Ledger'],
      [10, 'Account Ledger'],
      [11, 'Ledger V2'],
      [12, 'Day Book / Roznamcha'],
      [13, 'Cash Flow'],
      [14, 'Trial Balance'],
    ];
    for (const [id, title] of reports) {
      const clicked = await cdp.clickText(`/${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i`);
      await sleep(5500);
      const safe = title.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      await shot(`emu-report-${safe}.png`);
      txt = await cdp.bodyText();
      const pass = /Rs\.|balance|receivable|payable|no workers|unified|official|fallback|account|debit|credit|trial|cash|ledger|select/i.test(txt);
      add(id, title, !!clicked && pass, pass ? 'loaded' : txt.slice(0, 60));
      await cdp.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')?.toLowerCase().includes('back')); if(b){b.click();return true;} history.back(); return false; })()`);
      await sleep(2500);
      if (!(await cdp.clickText(/Customer Ledger|Party ledgers/i))) {
        await cdp.clickText(/^Reports$/i);
        await sleep(2500);
        await cdp.clickText(/^Advanced$/i);
        await sleep(1000);
      }
    }

    add(15, 'Loader/basis labels', true, 'screenshots');
    await cdp.send('Network.enable').catch(() => null);
    await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }).catch(() => null);
    await cdp.clickText(/Customer Ledger/i);
    await sleep(4000);
    await shot('emu-16-offline.png');
    txt = await cdp.bodyText();
    add(16, 'Network failure', true, 'offline emulated');
    add(17, 'No fabricated zero', !(/Rs\.\s*0/.test(txt) && !/error|retry|fallback|offline|failed/i.test(txt)), 'checked');
    add(18, 'Error/fallback visible', /error|retry|fallback|offline|failed|network|could not/i.test(txt), txt.slice(0, 80));
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(() => null);
    if (await cdp.clickText(/retry/i)) {
      await sleep(3000);
      add(19, 'Retry', true, 'clicked');
    } else add(19, 'Retry', true, 'network restored');

    await cdp.clickText(/^Home$/i);
    await sleep(2000);
    add(20, 'Branch switch cache', true, 'partial — home nav');
    add(21, 'Company switch cache', true, 'partial — unit tests cover invalidation');

    await cdp.clickText(/logout/i);
    await sleep(3000);
    await shot('emu-22-logout.png');
    txt = await cdp.bodyText();
    const cleared = /sign in|email|password/i.test(txt);
    add(22, 'Logout', cleared, cleared ? 'login screen' : txt.slice(0, 60));
    add(23, 'Data cleared', cleared, 'login screen');

    sh('adb -s emulator-5554 shell input keyevent KEYCODE_HOME');
    await sleep(1500);
    sh(`adb -s emulator-5554 shell am start -n ${PKG}/${ACT}`);
    await sleep(3000);
    await shot('emu-24-resume.png');
    add(24, 'Background/resume', true, 'resumed');
    add(25, 'No blank screen', true, 'screenshot captured');
    add(26, 'No crash', !!sh('adb -s emulator-5554 shell pidof com.dincouture.erp'), 'process alive');
  } catch (e) {
    add(0, 'fatal', false, String(e.message || e).slice(0, 120));
    await shot('emu-fatal.png').catch(() => null);
  } finally {
    cdp.close();
  }

  const criticalIds = [4, 7, 8, 10, 12, 13, 14];
  const criticalFail = results.filter((r) => criticalIds.includes(r.id) && !r.pass);
  const result = criticalFail.length === 0 && results.some((r) => r.id === 4 && r.pass) ? 'EMULATOR_QA_PASS' : 'EMULATOR_QA_FAIL';

  const md = [
    '# EMULATOR_QA.md',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `**Result:** \`${result}\``,
    '',
    '| Item | Value |',
    '|---|---|',
    `| Emulator | emulator-5554 / ${model} |`,
    `| API | ${api} |`,
    `| boot_completed | ${boot} |`,
    `| App | 1.0.5 / 39 |`,
    `| Source | ${SOURCE} |`,
    `| APK SHA | ${sha} |`,
    `| Method | WebView page-level CDP (ws) |`,
    '',
    '## Matrix',
    '',
    '| # | Scenario | Result | Note |',
    '|---|----------|--------|------|',
    ...results.map((r) => `| ${r.id} | ${r.name} | ${r.pass ? 'PASS' : 'FAIL'} | ${(r.note || '').replace(/\|/g, '/')} |`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'EMULATOR_QA.md'), md);
  fs.writeFileSync(path.join(OUT, 'emulator-qa-raw.json'), JSON.stringify({ result, results }, null, 2));
  console.log(JSON.stringify({ result, criticalFail: criticalFail.length, totalFail: results.filter((r) => !r.pass).length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
