/**
 * Map DB/PostgREST JE account-guard errors to actionable UI copy.
 * Keeps JOURNAL_ACCOUNT_* codes in the message for support, without SQL privilege noise.
 */
export function mapJournalAccountGuardError(raw: unknown): string {
  const msg = String(
    (raw as { message?: string })?.message ??
      (typeof raw === 'string' ? raw : '') ??
      '',
  ).trim();
  if (!msg) return 'Could not save journal entry. Please try again.';

  if (/JOURNAL_ACCOUNT_WRONG_COMPANY/i.test(msg)) {
    return 'That account belongs to another company. Choose an account from your company chart.';
  }
  if (/JOURNAL_ACCOUNT_RETIRED/i.test(msg)) {
    return 'That account is retired and has no verified remap. Choose the party’s active linked account (AP/AR/worker/courier leaf) or ask an admin to add a verified remap.';
  }
  if (/JOURNAL_ACCOUNT_INACTIVE|JOURNAL_ACCOUNT_NOT_FOUND|JOURNAL_ACCOUNT_/i.test(msg)) {
    // Prefer the human suffix after the code when present
    const after = msg.replace(/^[^:]*:\s*/i, '').trim();
    return after || 'Selected account cannot be used for posting. Pick a different account.';
  }
  if (/permission denied|42501|insufficient_privilege/i.test(msg)) {
    return 'You do not have permission to post this journal entry.';
  }
  return msg;
}
