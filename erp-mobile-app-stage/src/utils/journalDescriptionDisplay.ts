/** Keep aligned with src/app/utils/journalDescriptionDisplay.ts */

const EDIT_AUDIT_SUFFIX_RE = /\s*\[Edited[^\]]*\]/gi;

export function stripJournalEditAuditSuffix(description: string | null | undefined): string {
  return String(description ?? '')
    .replace(EDIT_AUDIT_SUFFIX_RE, '')
    .trim();
}

export function journalDescriptionForDisplay(
  description: string | null | undefined,
  fallback = '',
): string {
  const stripped = stripJournalEditAuditSuffix(description);
  return stripped || fallback;
}
