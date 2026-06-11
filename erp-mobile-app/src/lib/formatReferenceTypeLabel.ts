/** Human-readable label from journal reference_type (no GL logic change). */
export function formatReferenceTypeLabel(refType: string | null | undefined): string {
  const t = String(refType || '').trim();
  if (!t) return 'Journal Entry';
  return t
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
