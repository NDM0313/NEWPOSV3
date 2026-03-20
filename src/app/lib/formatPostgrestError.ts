/**
 * Normalize Supabase/PostgREST errors for toasts and debug UI.
 * Client throws may be the error object itself or `{ message, ... }` from a wrapper.
 */
export function formatPostgrestError(err: unknown): { summary: string; detailJson: string } {
  const e = err as Record<string, unknown> & { error?: Record<string, unknown> };
  const inner =
    e?.error && typeof e.error === 'object' ? (e.error as Record<string, unknown>) : e;
  const message = String(inner?.message ?? e?.message ?? err ?? 'Unknown error');
  const code = inner?.code;
  const details = inner?.details;
  const hint = inner?.hint;
  const detailObj = {
    message,
    code: code ?? undefined,
    details: details ?? undefined,
    hint: hint ?? undefined,
  };
  const detailJson = JSON.stringify(detailObj, null, 2);
  const parts: string[] = [message];
  if (details != null && details !== '') parts.push(String(details));
  if (hint != null && hint !== '') parts.push(`hint: ${String(hint)}`);
  if (code != null && code !== '') parts.push(`code: ${String(code)}`);
  return { summary: parts.join(' · '), detailJson };
}
