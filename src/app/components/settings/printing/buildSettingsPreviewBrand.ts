/**
 * Build company brand for settings print preview from SettingsContext company profile.
 */
import type { CompanyBrand } from '@/app/services/companyBrandService';

export function buildSettingsPreviewBrand(
  company: {
    businessName?: string;
    businessAddress?: string;
    businessPhone?: string;
    businessEmail?: string;
    taxId?: string;
    logoUrl?: string | null;
  },
  logoDisplayUrl: string,
): CompanyBrand {
  return {
    name: company.businessName || 'Your Company',
    address: company.businessAddress || '',
    phone: company.businessPhone || null,
    email: company.businessEmail || null,
    website: null,
    taxNumber: company.taxId || null,
    logoUrl: logoDisplayUrl || null,
    city: '',
    country: '',
  };
}
