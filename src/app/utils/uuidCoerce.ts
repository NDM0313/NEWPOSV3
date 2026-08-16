const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Normalize unknown values to a Postgres UUID string or null (never "[object Object]"). */
export function coerceUuidOrNull(value: unknown): string | null {
  if (value == null || value === '' || value === 'none' || value === '1') return null;
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t || t === '[object Object]') return null;
    return UUID_RE.test(t) ? t : null;
  }
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return coerceUuidOrNull((value as { id: unknown }).id);
  }
  const s = String(value);
  if (s === '[object Object]' || !UUID_RE.test(s)) return null;
  return s;
}

export function isUuidString(value: unknown): value is string {
  return coerceUuidOrNull(value) != null;
}
