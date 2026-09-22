/**
 * Unified print: Sunmi built-in → Bluetooth ESC/POS → browser print (A4 / dev).
 */

import { Capacitor } from '@capacitor/core';
import type { MobilePrinterMode, MobilePrinterPaperSize } from '../api/settings';
import {
  getNativePrinterCapabilities,
  nativePrintBluetooth,
  nativePrintRaw,
  type PrinterBackend,
} from '../lib/erpPrinterNative';
import { encodeEscPosUtf8 } from './thermalPrint';

export interface PrintResult {
  ok: boolean;
  backend?: PrinterBackend;
  hint?: string;
}

export interface PrintReceiptOptions {
  mode: MobilePrinterMode;
  paperSize: MobilePrinterPaperSize;
  bluetoothDeviceAddress?: string | null;
}

let cachedBackend: PrinterBackend | null = null;

export async function probePrinterBackend(
  bluetoothAddress?: string | null
): Promise<PrinterBackend> {
  const caps = await getNativePrinterCapabilities();
  if (caps.sunmi) {
    cachedBackend = 'sunmi';
    return 'sunmi';
  }
  if (caps.bluetooth && bluetoothAddress) {
    cachedBackend = 'bluetooth';
    return 'bluetooth';
  }
  if (Capacitor.getPlatform() === 'web') {
    cachedBackend = 'browser';
    return 'browser';
  }
  cachedBackend = 'none';
  return 'none';
}

export function getCachedPrinterBackendLabel(): string {
  switch (cachedBackend) {
    case 'sunmi':
      return 'Sunmi built-in';
    case 'bluetooth':
      return 'Bluetooth';
    case 'browser':
      return 'Browser';
    default:
      return Capacitor.isNativePlatform() ? 'Not connected' : 'Browser';
  }
}

export async function printReceiptLines(
  lines: string[],
  options: PrintReceiptOptions
): Promise<PrintResult> {
  if (options.mode === 'a4') {
    return printHtmlDocument(buildReceiptHtml(lines), 'Receipt');
  }

  const bytes = encodeEscPosUtf8(lines, options.paperSize);
  const backend = await probePrinterBackend(options.bluetoothDeviceAddress);

  if (backend === 'sunmi') {
    const ok = await nativePrintRaw(bytes);
    if (ok) return { ok: true, backend: 'sunmi' };
  }

  if (backend === 'bluetooth' && options.bluetoothDeviceAddress) {
    const ok = await nativePrintBluetooth(options.bluetoothDeviceAddress, bytes);
    if (ok) return { ok: true, backend: 'bluetooth' };
  }

  const bridge = (window as unknown as { ThermalPrinter?: { write?: (b: Uint8Array) => Promise<void> } })
    .ThermalPrinter;
  if (bridge?.write) {
    try {
      await bridge.write(bytes);
      return { ok: true, backend: 'bluetooth' };
    } catch (e) {
      return { ok: false, hint: e instanceof Error ? e.message : 'Printer write failed' };
    }
  }

  return {
    ok: false,
    hint:
      Capacitor.getPlatform() === 'web'
        ? 'Thermal printing needs the native app. Use Share slip or switch to A4.'
        : 'Pair a Bluetooth printer in Settings or use a Sunmi device.',
  };
}

export async function printTestReceipt(options: PrintReceiptOptions): Promise<PrintResult> {
  const lines = [
    'DIN COUTURE ERP',
    'Test Print',
    new Date().toLocaleString('en-PK'),
    `Mode: ${options.mode}`,
    `Paper: ${options.paperSize}`,
    '',
    'OK',
  ];
  return printReceiptLines(lines, options);
}

export async function printHtmlDocument(html: string, title: string): Promise<PrintResult> {
  try {
    if (Capacitor.isNativePlatform()) {
      return printHtmlInAppOverlay(html, title);
    }

    const docHtml = injectBrowserPrintChrome(html);
    const w = window.open('', '_blank', 'width=400,height=600');
    if (!w) {
      return { ok: false, hint: 'Allow pop-ups to print, or use Share.' };
    }
    w.document.write(docHtml);
    w.document.title = title;
    w.document.close();
    w.focus();
    return { ok: true, backend: 'browser' };
  } catch (e) {
    return { ok: false, hint: e instanceof Error ? e.message : 'Print failed' };
  }
}

const PRINT_VIEWPORT_META =
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>';

const BROWSER_PRINT_STYLES = `
  html {
    padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
  }
  .erp-print-toolbar {
    position: sticky;
    top: 0;
    z-index: 10;
    margin: 0 0 16px;
    padding: max(12px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) 12px max(16px, env(safe-area-inset-left, 0px));
    background: #1f2937;
    color: #f9fafb;
    border-bottom: 1px solid #374151;
    font-family: system-ui, sans-serif;
    font-size: 13px;
  }
  .erp-print-hint { margin: 0 0 10px; color: #9ca3af; line-height: 1.4; }
  .erp-print-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .erp-print-actions button {
    padding: 10px 16px;
    border-radius: 8px;
    border: 1px solid #4b5563;
    background: #374151;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    touch-action: manipulation;
  }
  .erp-print-actions .erp-print-close {
    background: #3b82f6;
    border-color: #2563eb;
  }
  @media print {
    .no-print { display: none !important; }
    html { padding: 0; }
  }
`;

const BROWSER_PRINT_CHROME = `
<div id="erp-print-toolbar" class="erp-print-toolbar no-print">
  <p class="erp-print-hint">No printer? Tap <strong>Close</strong> to return to the app.</p>
  <div class="erp-print-actions">
    <button type="button" id="erp-print-again">Print again</button>
    <button type="button" class="erp-print-close" id="erp-print-close">Close</button>
  </div>
</div>
<script>
(function () {
  var closed = false;
  function tryClose() {
    if (closed) return;
    closed = true;
    try { window.close(); } catch (e) {}
    window.setTimeout(function () {
      if (typeof window.closed !== 'undefined' && window.closed) return;
      try {
        if (window.history.length > 1) { window.history.back(); return; }
      } catch (e) {}
      try {
        if (window.opener) { window.opener.focus(); window.close(); return; }
      } catch (e) {}
      closed = false;
      var hint = document.querySelector('.erp-print-hint');
      if (hint) hint.textContent = 'Use your device back button to return to the app.';
    }, 120);
  }
  window.onafterprint = tryClose;
  window.addEventListener('load', function () {
    var closeBtn = document.getElementById('erp-print-close');
    var againBtn = document.getElementById('erp-print-again');
    if (closeBtn) closeBtn.addEventListener('click', tryClose);
    if (againBtn) againBtn.addEventListener('click', function () {
      try { window.print(); } catch (e) {}
    });
    window.setTimeout(function () {
      try { window.print(); } catch (e) {}
    }, 150);
  });
})();
</script>
`;

function ensureViewportMeta(html: string): string {
  if (html.includes('viewport-fit=cover')) return html;
  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>${PRINT_VIEWPORT_META}`);
  }
  return `${PRINT_VIEWPORT_META}${html}`;
}

function stripPrintChrome(html: string): string {
  return html
    .replace(/<div id="erp-print-toolbar"[\s\S]*?<\/div>\s*/g, '')
    .replace(/<script>\s*\(function \(\) \{[\s\S]*?\}\)\(\);\s*<\/script>\s*/g, '');
}

function styleActionButton(btn: HTMLButtonElement, primary = false) {
  Object.assign(btn.style, {
    padding: '10px 16px',
    borderRadius: '8px',
    border: primary ? '1px solid #2563eb' : '1px solid #4b5563',
    background: primary ? '#3b82f6' : '#374151',
    color: '#fff',
    fontSize: '14px',
    cursor: 'pointer',
    touchAction: 'manipulation',
    fontFamily: 'system-ui, sans-serif',
  });
}

/** Native app: fullscreen overlay in parent DOM so Close always works (window.close is blocked in WebView). */
function printHtmlInAppOverlay(html: string, title: string): PrintResult {
  document.getElementById('erp-print-overlay-root')?.remove();

  const prevOverflow = document.body.style.overflow;
  const root = document.createElement('div');
  root.id = 'erp-print-overlay-root';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', title);
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '99999',
    display: 'flex',
    flexDirection: 'column',
    background: '#111827',
  });

  const toolbar = document.createElement('div');
  Object.assign(toolbar.style, {
    flexShrink: '0',
    paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
    paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
    paddingBottom: '12px',
    paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
    background: '#1f2937',
    borderBottom: '1px solid #374151',
    fontFamily: 'system-ui, sans-serif',
  });

  const hint = document.createElement('p');
  hint.textContent = 'No printer? Tap Close to return to the app.';
  Object.assign(hint.style, {
    margin: '0 0 10px',
    color: '#9ca3af',
    fontSize: '13px',
    lineHeight: '1.4',
  });

  const actions = document.createElement('div');
  Object.assign(actions.style, { display: 'flex', gap: '8px', flexWrap: 'wrap' });

  const printAgainBtn = document.createElement('button');
  printAgainBtn.type = 'button';
  printAgainBtn.textContent = 'Print again';
  styleActionButton(printAgainBtn, false);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Close';
  styleActionButton(closeBtn, true);

  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    flex: '1',
    width: '100%',
    border: '0',
    background: '#ffffff',
  });
  iframe.title = title;

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    root.remove();
    document.body.style.overflow = prevOverflow;
  };

  closeBtn.addEventListener('click', dismiss);

  actions.append(printAgainBtn, closeBtn);
  toolbar.append(hint, actions);
  root.append(toolbar, iframe);
  document.body.append(root);
  document.body.style.overflow = 'hidden';

  const contentHtml = ensureViewportMeta(stripPrintChrome(html));
  const frameDoc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!frameDoc) {
    dismiss();
    return { ok: false, hint: 'Could not open print preview.' };
  }

  frameDoc.open();
  frameDoc.write(contentHtml);
  frameDoc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      /* toolbar stays for manual close / reprint */
    }
  };

  printAgainBtn.addEventListener('click', triggerPrint);

  iframe.addEventListener('load', () => {
    try {
      iframe.contentWindow?.addEventListener('afterprint', dismiss);
    } catch {
      /* ignore */
    }
    window.setTimeout(triggerPrint, 200);
  });

  return { ok: true, backend: 'browser' };
}

function injectBrowserPrintChrome(html: string): string {
  if (html.includes('id="erp-print-toolbar"')) return ensureViewportMeta(html);

  let doc = html;
  if (doc.includes('</head>') && !doc.includes('erp-print-toolbar')) {
    doc = doc.replace('</head>', `<style>${BROWSER_PRINT_STYLES}</style></head>`);
  }
  if (doc.includes('</body>')) {
    doc = doc.replace('</body>', `${BROWSER_PRINT_CHROME}</body>`);
  } else {
    doc = `<!DOCTYPE html><html><head><meta charset="utf-8"/>${PRINT_VIEWPORT_META}<style>${BROWSER_PRINT_STYLES}</style></head><body>${doc}${BROWSER_PRINT_CHROME}</body></html>`;
  }
  return ensureViewportMeta(doc);
}

function buildReceiptHtml(lines: string[]): string {
  const body = lines.map((l) => `<div>${escapeHtml(l)}</div>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>${PRINT_VIEWPORT_META}<style>
    body{font-family:monospace;font-size:12px;padding:16px;max-width:80mm;margin:0 auto;}
    @media print{body{max-width:100%;}}
    ${BROWSER_PRINT_STYLES}
  </style></head><body>${body}${BROWSER_PRINT_CHROME}</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
