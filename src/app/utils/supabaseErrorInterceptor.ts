/**
 * Supabase API error interceptor.
 * Wraps Supabase client to catch and handle errors consistently.
 * Use handleSupabaseError for manual error handling in services.
 */
import { PostgrestError } from '@supabase/supabase-js';
import { formatApiErrorForDisplay, handleApiError } from './errorUtils';

export function getSupabaseErrorMessage(error: PostgrestError | null): string {
  if (!error) return 'Unknown error';
  return formatApiErrorForDisplay(error, 'Database error');
}

export function handleSupabaseError(context: string, error: { error?: PostgrestError | null } | Error): void {
  const err = error as { error?: PostgrestError | null };
  if (err?.error) {
    handleApiError(context, err.error);
  } else if (error instanceof Error) {
    handleApiError(context, error);
  } else {
    handleApiError(context, new Error('Unknown error'));
  }
}
