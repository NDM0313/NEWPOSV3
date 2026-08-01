import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMonitoringSqlShell } from './monitoringSshSql.mjs';

test('resolveMonitoringSqlShell uses powershell only on Windows', () => {
  const original = process.platform;
  try {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    assert.equal(resolveMonitoringSqlShell(), '/bin/sh');
    Object.defineProperty(process, 'platform', { value: 'linux' });
    assert.equal(resolveMonitoringSqlShell(), '/bin/sh');
    Object.defineProperty(process, 'platform', { value: 'win32' });
    assert.equal(resolveMonitoringSqlShell(), 'powershell.exe');
  } finally {
    Object.defineProperty(process, 'platform', { value: original });
  }
});

test('monitoring SSH helper does not hardcode powershell.exe on darwin', () => {
  const original = process.platform;
  try {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    assert.notEqual(resolveMonitoringSqlShell(), 'powershell.exe');
  } finally {
    Object.defineProperty(process, 'platform', { value: original });
  }
});
