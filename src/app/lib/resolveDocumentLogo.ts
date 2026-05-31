/**
 * Resolve logo for documents: per-template override wins, else company default.
 */
export function resolveDocumentLogoUrl(
  templateLogo: string | null | undefined,
  companyLogo: string | null | undefined
): string | null {
  const t = templateLogo?.trim();
  if (t) return t;
  const c = companyLogo?.trim();
  return c || null;
}
