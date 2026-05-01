/** Dev-only sync tracing (pending type, id, outcomes). */

export function isSyncDebugEnabled(): boolean {
  return Boolean(import.meta.env.DEV);
}

export function syncDebugLog(message: string, detail?: Record<string, unknown>): void {
  if (!isSyncDebugEnabled()) return;
  if (detail !== undefined) console.log('[sync]', message, detail);
  else console.log('[sync]', message);
}
