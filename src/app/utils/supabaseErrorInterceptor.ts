/**
 * Supabase API error interceptor.
 * Wraps Supabase client to catch and handle errors consistently.
 * Use handleSupabaseError for manual error handling in services.
 */
import { PostgrestError } from '@supabase/supabase-js';
import { handleApiError } from './errorUtils';

export function getSupabaseErrorMessage(error: PostgrestError | null): string {
  if (!error) return 'Unknown error';
  if (error.code === 'PGRST301') return 'Permission denied';
  if (error.code === '23505') return 'Duplicate record';
  if (error.code === '23503') return 'Referenced record not found';
  return error.message || 'Database error';
}

export function handleSupabaseError(context: string, error: { error?: PostgrestError | null } | Error): void {
  const err = error as { error?: PostgrestError | null };
  const msg = err?.error ? getSupabaseErrorMessage(err.error) : (error instanceof Error ? error.message : 'Unknown error');
  handleApiError(context, new Error(msg));
}
