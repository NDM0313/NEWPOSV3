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

function messageFrom(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message?: string }).message ?? '');
  }
  return String(err);
}

export function isStorageRlsError(err: unknown): boolean {
  const msg = messageFrom(err).toLowerCase();
  return msg.includes('row-level security') || msg.includes('policy');
}

export function isStorageAuthError(err: unknown): boolean {
  const msg = messageFrom(err).toLowerCase();
  if (typeof err === 'object' && err !== null) {
    const status =
      (err as { status?: number; statusCode?: number }).status
      ?? (err as { statusCode?: number }).statusCode;
    if (status === 401 || status === 403) {
      return !isStorageRlsError(err);
    }
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
  const msg = messageFrom(err).toLowerCase();
  if (typeof err === 'object' && err !== null) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 400 && msg.includes('bucket')) return true;
  }
  return msg.includes('bucket') && (msg.includes('not found') || msg.includes('does not exist'));
}

export function isStorageUpstreamUnavailableError(err: unknown): boolean {
  const msg = messageFrom(err).toLowerCase();
  if (typeof err === 'object' && err !== null) {
    const status =
      (err as { status?: number; statusCode?: number }).status
      ?? (err as { statusCode?: number }).statusCode;
    if (status === 502 || status === 503) return true;
  }
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
      userMessage: 'Storage bucket missing on server. Contact admin to run deploy.',
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
