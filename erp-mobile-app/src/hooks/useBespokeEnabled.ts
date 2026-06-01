import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/** Company-level customization toggle (business_settings.enable_bespoke_orders). */
export function useBespokeEnabled(companyId: string | null | undefined): {
  enabled: boolean;
  loading: boolean;
} {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setEnabled(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('business_settings')
        .select('enable_bespoke_orders')
        .eq('company_id', companyId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setEnabled(false);
      } else {
        setEnabled((data as { enable_bespoke_orders?: boolean } | null)?.enable_bespoke_orders === true);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return { enabled, loading };
}
