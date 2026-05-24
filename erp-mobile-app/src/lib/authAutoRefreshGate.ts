/**
 * Ref-counted pause/resume for Supabase autoRefreshToken.
 * Used during counter lock, PIN unlock, and vault maintenance to avoid refresh_token races.
 */

let pauseDepth = 0;

export function isAuthAutoRefreshPaused(): boolean {
  return pauseDepth > 0;
}

export function pauseAuthAutoRefresh(_reason?: string): void {
  pauseDepth += 1;
  if (pauseDepth === 1) {
    void import('./supabase').then(({ supabase }) => supabase.auth.stopAutoRefresh());
  }
}

export function resumeAuthAutoRefresh(): void {
  if (pauseDepth <= 0) return;
  pauseDepth -= 1;
  if (pauseDepth === 0) {
    void import('./supabase').then(({ supabase }) => supabase.auth.startAutoRefresh());
  }
}
