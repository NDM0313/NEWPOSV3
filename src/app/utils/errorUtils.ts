/**
 * Centralized error handling & logging for ERP.
 * - Standardized toast error format
 * - Optional logging (dev/production toggle)
 * - No silent failures
 */
import { toast } from 'sonner';
import type { PostgrestError } from '@supabase/supabase-js';
import { isVerboseApiErrorsEnabled } from '@/app/lib/developerMode';

const LOG_ENABLED = import.meta.env?.DEV ?? false;

export function logError(context: string, error: unknown, extra?: Record<string, unknown>): void {
  const err = error instanceof Error ? error : new Error(String(error));
  if (LOG_ENABLED) {
    console.error(`[${context}]`, err.message, err.stack, extra ?? '');
  }
}

function isPostgrestError(e: unknown): e is PostgrestError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'message' in e &&
    typeof (e as PostgrestError).message === 'string'
  );
}

/** User-facing message: friendly by default; verbose when Developer Tools toggle is on. */
export function formatApiErrorForDisplay(error: unknown, fallbackMessage: string): string {
  if (isPostgrestError(error)) {
    if (isVerboseApiErrorsEnabled()) {
      const parts = [
        error.message,
        error.code && `[${error.code}]`,
        error.details,
        error.hint,
      ].filter(Boolean) as string[];
      return parts.join(' · ') || fallbackMessage;
    }
    if (error.code === 'PGRST301') return 'Permission denied';
    if (error.code === '23505') return 'Duplicate record';
    if (error.code === '23503') return 'Referenced record not found';
    return error.message || 'Database error';
  }
  if (error instanceof Error) {
    return error.message || fallbackMessage;
  }
  if (typeof error === 'string') {
    return error || fallbackMessage;
  }
  if (isVerboseApiErrorsEnabled() && error !== null && typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return fallbackMessage;
}

export function showErrorToast(message: string, context?: string): void {
  toast.error(message, {
    description: context ? `Error: ${context}` : undefined,
    duration: 5000,
  });
}

export function handleApiError(context: string, error: unknown, fallbackMessage = 'Operation failed'): void {
  logError(context, error);
  const message = formatApiErrorForDisplay(error, fallbackMessage);
  showErrorToast(message, context);
}

/** Permission denied - use when user lacks permission */
export function showPermissionDenied(message?: string): void {
  showErrorToast(message ?? 'You do not have permission to perform this action.');
}
