import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let cachedConfig = null;

export function loadPaymentAccountConfig() {
  if (cachedConfig) return cachedConfig;
  const configPath = path.join(TOOLS_ROOT, 'config', 'din_china_payment_accounts.json');
  cachedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return cachedConfig;
}

/** Map legacy UltimatePOS method string to RPC payment_method enum. */
export function mapLegacyPaymentMethod(legacyMethod) {
  const config = loadPaymentAccountConfig();
  const key = String(legacyMethod || 'cash').trim().toLowerCase();
  const entry = config.methodMap[key] || config.methodMap.cash;
  return {
    legacyMethod: key,
    rpcMethod: entry.rpcMethod,
    defaultLegacyAccountId: entry.defaultLegacyAccountId,
  };
}

export function legacyAccountConfigById(legacyAccountId) {
  const config = loadPaymentAccountConfig();
  const id = Number(legacyAccountId);
  return config.legacyAccounts.find((a) => Number(a.legacyId) === id) || null;
}

export function allLegacyAccountConfigs() {
  return loadPaymentAccountConfig().legacyAccounts;
}
