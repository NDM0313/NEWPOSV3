import { supabase, isSupabaseConfigured } from '../lib/supabase';

/** Match web party subledger setup so AR/AP accounts appear in statements and posting. */
export async function ensurePartySubledgersForContact(
  contactId: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured || !contactId) {
    return { success: false, error: 'App not configured.' };
  }
  const { data, error } = await supabase.rpc('ensure_party_subledgers_for_contact', {
    p_contact_id: contactId,
  });
  if (error) return { success: false, error: error.message };
  const result = data as { success?: boolean; error?: string } | null;
  if (!result?.success) {
    return { success: false, error: result?.error || 'Could not create party accounts.' };
  }
  return { success: true, error: null };
}
