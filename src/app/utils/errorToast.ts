/**
 * Standardized error toast format.
 * Use for API errors, validation, and user-facing failures.
 */
import { toast } from 'sonner';

export interface ApiError {
  message?: string;
  code?: string;
  details?: string;
}

/**
 * Show standardized error toast. Prevents silent failures.
 */
export function showErrorToast(
  error: unknown,
  fallbackMessage: string = 'An error occurred'
): void {
  let message = fallbackMessage;

  if (error instanceof Error) {
    message = error.message || fallbackMessage;
  } else if (typeof error === 'object' && error !== null && 'message' in error) {
    message = String((error as ApiError).message) || fallbackMessage;
  } else if (typeof error === 'string') {
    message = error;
  }

  toast.error(message, {
    duration: 5000,
    description: import.meta.env?.DEV ? String(error) : undefined,
  });
}

/**
 * Show success toast with consistent styling.
 */
export function showSuccessToast(message: string): void {
  toast.success(message, { duration: 3000 });
}
