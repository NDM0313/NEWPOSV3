const lastRunByKey = new Map<string, number>();

export function shouldRunFocusRefresh(key: string, minIntervalMs: number): boolean {
  const now = Date.now();
  const prev = lastRunByKey.get(key) ?? 0;
  if (now - prev < minIntervalMs) return false;
  lastRunByKey.set(key, now);
  return true;
}
