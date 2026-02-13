/**
 * Centralized error handling & logging for ERP.
 * - Standardized toast error format
 * - Optional logging (dev/production toggle)
 * - No silent failures
 */
import { toast } from 'sonner';

const LOG_ENABLED = import.meta.env?.DEV ?? false;

export function logError(context: string, error: unknown, extra?: Record<string, unknown>): void {
  const err = error instanceof Error ? error : new Error(String(error));
  if (LOG_ENABLED) {
    console.error(`[${context}]`, err.message, err.stack, extra ?? '');
  }
}

export function showErrorToast(message: string, context?: string): void {
  toast.error(message, {
    description: context ? `Error: ${context}` : undefined,
    duration: 5000,
  });
}

export function handleApiError(context: string, error: unknown, fallbackMessage = 'Operation failed'): void {
  logError(context, error);
  const message = error instanceof Error ? error.message : fallbackMessage;
  showErrorToast(message, context);
}

/** Permission denied - use when user lacks permission */
export function showPermissionDenied(message?: string): void {
  showErrorToast(message ?? 'You do not have permission to perform this action.');
}
