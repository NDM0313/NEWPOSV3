/**
 * Classify storage upload failures for user-facing attachment warnings (mobile PWA).
 */

export type StorageUploadErrorKind = 'rls' | 'timeout' | 'auth' | 'size' | 'bucket' | 'unknown';

export interface UploadFailure {
  fileName: string;
  kind: StorageUploadErrorKind;
  userMessage: string;
}

export interface UploadWithFailuresResult<T> {
  results: T[];
  failures: UploadFailure[];
}

export function messageFrom(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null) {
    const rec = err as { message?: string; error?: string };
    const parts = [rec.message, rec.error].filter(Boolean).map(String);
    if (parts.length) return parts.join(' ');
  }
  return String(err);
}

export function storageErrorStatus(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null;
  const rec = err as { status?: number; statusCode?: number };
  return rec.status ?? rec.statusCode ?? null;
}

const BUCKET_MISSING_PHRASES = [
  'bucket not found',
  'invalid bucket',
  'no such bucket',
  'does not exist',
  'invalidbucket',
  'bucket_id',
];

function messageSuggestsMissingBucket(msg: string): boolean {
  const lower = msg.toLowerCase();
  if (!lower) return false;
  return BUCKET_MISSING_PHRASES.some((p) => lower.includes(p));
}

export function isStorageRlsError(err: unknown): boolean {
  const msg = messageFrom(err).toLowerCase();
  return msg.includes('row-level security') || msg.includes('policy');
}

export function isStorageAuthError(err: unknown): boolean {
  const msg = messageFrom(err).toLowerCase();
  const status = storageErrorStatus(err);
  if (status === 401 || status === 403) {
    return !isStorageRlsError(err);
  }
  return (
    msg.includes('jwt') ||
    msg.includes('not authorized') ||
    msg.includes('unauthorized') ||
    msg.includes('invalid claim') ||
    msg.includes('session')
  );
}

export function isStorageTimeoutError(err: unknown): boolean {
  const msg = messageFrom(err).toLowerCase();
  return msg.includes('timed out after') || msg.includes('timeout') || msg.includes('network');
}

export function isStorageSizeError(err: unknown): boolean {
  const msg = messageFrom(err).toLowerCase();
  return (
    (msg.includes('exceeded') && (msg.includes('maximum') || msg.includes('size'))) ||
    msg.includes('payload too large') ||
    msg.includes('too large')
  );
}

export function isBucketNotFoundError(err: unknown): boolean {
  const msg = messageFrom(err);
  const lower = msg.toLowerCase();
  const status = storageErrorStatus(err);

  if (messageSuggestsMissingBucket(lower)) return true;

  if (status === 400) {
    if (lower.includes('bucket')) return true;
    if (!lower || lower === 'bad request' || lower.includes('invalid request')) return true;
  }

  if (status === 404 && lower.includes('bucket')) return true;

  return lower.includes('bucket') && (lower.includes('not found') || lower.includes('does not exist'));
}

export function isStorageUpstreamUnavailableError(err: unknown): boolean {
  const msg = messageFrom(err).toLowerCase();
  const status = storageErrorStatus(err);
  if (status === 502 || status === 503) return true;
  return (
    msg.includes('service unavailable') ||
    msg.includes('name resolution failed') ||
    msg.includes('bad gateway')
  );
}

export function classifyStorageUploadError(
  err: unknown,
  fileName = 'file',
): { kind: StorageUploadErrorKind; userMessage: string } {
  if (isStorageRlsError(err)) {
    return {
      kind: 'rls',
      userMessage:
        'Storage upload blocked (permissions). Ask admin to run deploy on VPS or apply storage RLS.',
    };
  }
  if (isStorageAuthError(err)) {
    return {
      kind: 'auth',
      userMessage: 'Session expired during upload. Sign in again and retry the attachment.',
    };
  }
  if (isStorageTimeoutError(err)) {
    return {
      kind: 'timeout',
      userMessage: `Upload timed out for "${fileName}". Check connection and try again.`,
    };
  }
  if (isStorageSizeError(err)) {
    return {
      kind: 'size',
      userMessage: `File "${fileName}" is too large. Use a smaller or compressed file.`,
    };
  }
  if (isBucketNotFoundError(err)) {
    return {
      kind: 'bucket',
      userMessage:
        'Storage bucket "expense-receipts" missing on server. Ask admin to run deploy on VPS (apply-fixes-now.sh). You can save without the attachment.',
    };
  }
  if (isStorageUpstreamUnavailableError(err)) {
    return {
      kind: 'unknown',
      userMessage:
        'Storage server unavailable (503). On VPS run: bash deploy/fix-kong-storage-upstream.sh',
    };
  }
  const raw = messageFrom(err);
  return {
    kind: 'unknown',
    userMessage: raw ? `Upload failed: ${raw}` : 'Upload failed. Try again.',
  };
}

/** Build attachmentWarning text for payment/sale flows. */
export function attachmentUploadWarningMessage(
  uploadedCount: number,
  totalCount: number,
  failures: UploadFailure[],
): string | null {
  if (totalCount === 0 || uploadedCount >= totalCount) return null;

  const prefix = uploadedCount > 0 ? 'Payment saved.' : 'Saved without attachments.';
  if (failures.length === 0) {
    return `${prefix} ${totalCount - uploadedCount} file(s) did not upload — try again.`;
  }

  const primary = failures[0];
  if (failures.every((f) => f.kind === primary.kind)) {
    return `${prefix} ${primary.userMessage}`;
  }
  return `${prefix} Some attachments failed (${uploadedCount}/${totalCount} uploaded). ${primary.userMessage}`;
}
