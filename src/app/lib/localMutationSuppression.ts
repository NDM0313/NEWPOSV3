/** Suppress realtime invalidation echoes from the client's own writes (2–3s window). */

const DEFAULT_MS = 3000;
let suppressRealtimeUntil = 0;

export function markLocalMutation(windowMs: number = DEFAULT_MS): void {
  suppressRealtimeUntil = Date.now() + windowMs;
}

export function shouldSuppressRealtimeInvalidation(): boolean {
  return Date.now() < suppressRealtimeUntil;
}
