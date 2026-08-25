/**
 * Cross-platform read-only SQL execution against production Postgres via SSH.
 * Uses Node stdin piping — no powershell.exe required on macOS/Linux.
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const SSH_HOST = process.env.DINCOUTURE_SSH_HOST || 'dincouture-vps';
const PSQL_REMOTE = 'docker exec -i supabase-db psql -U postgres -d postgres';

/**
 * @param {string} sql
 * @param {{ psqlArgs?: string; maxBuffer?: number }} [options]
 */
export function execSqlViaSsh(sql, options = {}) {
  const psqlArgs = options.psqlArgs ?? '-t -A';
  const remote = `${PSQL_REMOTE} ${psqlArgs}`;
  return execSync(`ssh ${SSH_HOST} "${remote}"`, {
    input: sql,
    encoding: 'utf8',
    maxBuffer: options.maxBuffer ?? 1024 * 1024,
  });
}

/**
 * @param {string} sqlFilePath
 * @param {{ psqlArgs?: string; maxBuffer?: number }} [options]
 */
export function execSqlFileViaSsh(sqlFilePath, options = {}) {
  const sql = fs.readFileSync(sqlFilePath, 'utf8');
  return execSqlViaSsh(sql, options);
}

/** Shell used for legacy pipe commands — Node stdin path does not use a shell. */
export function resolveMonitoringSqlShell() {
  if (process.platform === 'win32') {
    return 'powershell.exe';
  }
  return '/bin/sh';
}
