/**
 * Suppress PIN/counter relock while native camera or file picker is open.
 * Ref-counted so nested pickers are safe.
 */

const RECENT_CAPTURE_MS = 120_000;

let captureDepth = 0;
let lastCaptureEndedAt = 0;

export function beginMediaCapture(): void {
  captureDepth += 1;
}

export function endMediaCapture(): void {
  if (captureDepth > 0) captureDepth -= 1;
  if (captureDepth === 0) {
    lastCaptureEndedAt = Date.now();
  }
}

export function isMediaCaptureActive(): boolean {
  return captureDepth > 0;
}

export function wasMediaCaptureRecent(withinMs: number = RECENT_CAPTURE_MS): boolean {
  if (captureDepth > 0) return true;
  if (lastCaptureEndedAt === 0) return false;
  return Date.now() - lastCaptureEndedAt < withinMs;
}
