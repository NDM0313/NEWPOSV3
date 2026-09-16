/** Dev-only save path timing (labels + ms only — no payloads or secrets). */
export function isWebSaveTimingEnabled(): boolean {
  return import.meta.env?.DEV === true;
}

export function webSaveTimingMark(label: string, startMs?: number): number {
  const now = performance.now();
  if (isWebSaveTimingEnabled() && startMs != null) {
    console.info('[web-save-timing]', label, Math.round(now - startMs));
  }
  return now;
}

export function webSaveTimingStart(label: string): number {
  if (isWebSaveTimingEnabled()) {
    console.info('[web-save-timing]', label, 'start');
  }
  return performance.now();
}
