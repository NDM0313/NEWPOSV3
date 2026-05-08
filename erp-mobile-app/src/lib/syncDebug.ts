/** Dev-only sync tracing (pending type, id, outcomes). Requires VITE_SHOW_ERP_DEV_TOOLS=true. */

import { showErpDevTools } from '../utils/erpDevTools';

export function isSyncDebugEnabled(): boolean {
  return showErpDevTools();
}

export function syncDebugLog(message: string, detail?: Record<string, unknown>): void {
  if (!isSyncDebugEnabled()) return;
  if (detail !== undefined) console.log('[sync]', message, detail);
  else console.log('[sync]', message);
}
