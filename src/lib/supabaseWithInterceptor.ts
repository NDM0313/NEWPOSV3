/**
 * Supabase client with API error interceptor.
 * Wraps responses to catch and surface errors consistently.
 * Use this for critical paths, or keep original supabase for simple cases.
 */

import { supabase } from './supabase';
import { handleApiError } from '@/app/utils/errorUtils';

/** Wrap a supabase query to show toast on error. Returns data or null. */
export async function supabaseWithErrorHandling<T>(
  query: () => Promise<{ data: T | null; error: { message: string } | null }>,
  fallbackMessage = 'Operation failed.',
  context = 'Supabase'
): Promise<T | null> {
  const { data, error } = await query();
  if (error) {
    handleApiError(error, fallbackMessage, context);
    return null;
  }
  return data;
}

/** Re-export supabase for direct use */
export { supabase };
