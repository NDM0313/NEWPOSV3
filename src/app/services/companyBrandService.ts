import { supabase } from '@/lib/supabase';
import { getCompanyLogoDisplayUrl } from '@/app/utils/companyLogoUpload';

export interface CompanyBrand {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  taxNumber: string | null;
  logoUrl: string | null;
  city: string | null;
  country: string | null;
}

const FALLBACK: CompanyBrand = {
  name: 'Company',
  address: null,
  phone: null,
  email: null,
  website: null,
  taxNumber: null,
  logoUrl: null,
  city: null,
  country: null,
};

/** Company identity for branded PDF/print report headers. */
export async function getCompanyBrand(companyId: string | null): Promise<CompanyBrand> {
  if (!companyId) return FALLBACK;
  const { data } = await supabase
    .from('companies')
    .select('name, address, phone, email, website, tax_number, logo_url, city, country')
    .eq('id', companyId)
    .maybeSingle();
  if (!data) return FALLBACK;
  const row = data as Record<string, unknown>;
  const rawLogo = (row.logo_url as string) ?? null;
  const logoUrl = rawLogo ? await getCompanyLogoDisplayUrl(rawLogo) : null;
  return {
    name: (row.name as string) || 'Company',
    address: (row.address as string) ?? null,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    website: (row.website as string) ?? null,
    taxNumber: (row.tax_number as string) ?? null,
    logoUrl,
    city: (row.city as string) ?? null,
    country: (row.country as string) ?? null,
  };
}
