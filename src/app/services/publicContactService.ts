import { supabase } from '@/lib/supabase';

export interface RegisterPublicContactInput {
  first_name: string;
  last_name: string;
  mobile: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  notes?: string;
  contact_type: 'customer' | 'supplier' | 'worker';
  lead_source?: string;
  referral_code?: string;
  device_info?: string;
  honeypot?: string;
  captcha_answer?: number;
  client_fingerprint?: string;
}

export interface RegisterPublicContactResult {
  success: boolean;
  contact_id?: string;
  error?: string;
}

export const publicContactService = {
  async register(input: RegisterPublicContactInput): Promise<RegisterPublicContactResult> {
    const { data, error } = await supabase.rpc('register_public_contact_v2', {
      p_first_name: input.first_name.trim(),
      p_last_name: input.last_name.trim(),
      p_mobile: input.mobile.trim(),
      p_email: input.email?.trim() || null,
      p_address: input.address?.trim() || null,
      p_city: input.city?.trim() || null,
      p_country: input.country?.trim() || null,
      p_notes: input.notes?.trim() || null,
      p_contact_type: input.contact_type,
      p_lead_source: input.lead_source?.trim() || null,
      p_referral_code: input.referral_code?.trim() || null,
      p_device_info: input.device_info || null,
      p_honeypot: input.honeypot || null,
      p_captcha_answer: input.captcha_answer ?? null,
      p_client_fingerprint: input.client_fingerprint || null,
    });

    if (error) {
      return { success: false, error: error.message || 'Registration failed' };
    }

    const result = data as { success?: boolean; contact_id?: string; error?: string };
    return {
      success: !!result?.success,
      contact_id: result?.contact_id,
      error: result?.error,
    };
  },
};
