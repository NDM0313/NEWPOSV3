import { createHash } from 'node:crypto';

/** Deterministic UUID-shaped id for legacy integer keys (stable across re-runs). */
export function legacyToUuid(namespace, legacyId) {
  const key = `phase13:${namespace}:${String(legacyId)}`;
  const hex = createHash('sha256').update(key).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function stripHtml(html) {
  if (html == null || html === '') return null;
  const s = String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&rsquo;|&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return s || null;
}
