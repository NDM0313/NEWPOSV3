export type NormalizedAttachment = { url: string; name: string };

/**
 * Normalize `sales.attachments`, `purchases.attachments`, `payments.attachments`
 * from DB (jsonb array or legacy JSON string).
 */
export function normalizeAttachments(raw: unknown): NormalizedAttachment[] {
  const fromArray = (arr: unknown[]): NormalizedAttachment[] =>
    arr
      .map((a: unknown) => {
        const o = a as Record<string, unknown>;
        return { url: String(o?.url ?? ''), name: String(o?.name ?? 'Attachment') };
      })
      .filter((a) => a.url.length > 0);

  if (Array.isArray(raw) && raw.length > 0) {
    return fromArray(raw);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) return fromArray(parsed);
    } catch {
      /* ignore */
    }
  }
  return [];
}

export function hasNormalizedAttachments(raw: unknown): boolean {
  return normalizeAttachments(raw).length > 0;
}
