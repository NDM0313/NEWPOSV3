/**
 * Mirrors web wizard defaults for mobile create-business (no dependency on src/app).
 * @see src/app/config/companyBootstrapRegistry.ts
 */

export const BUSINESS_TYPE_MODULES: Record<string, string[]> = {
  retail: ['sales', 'pos', 'accounting', 'reports'],
  wholesale: ['sales', 'purchases', 'accounting', 'reports'],
  manufacturing: ['purchases', 'studio', 'production', 'sales', 'accounting', 'reports'],
  rental: ['rentals', 'sales', 'accounting', 'reports'],
  mixed: ['sales', 'purchases', 'rentals', 'pos', 'studio', 'production', 'accounting', 'expenses', 'payroll', 'reports'],
};

export const WIZARD_BUSINESS_TYPES = [
  { value: 'retail', label: 'Retail' },
  { value: 'rental', label: 'Rental' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'mixed', label: 'Mixed' },
] as const;

export function modulesForBusinessType(type: string): string[] {
  return BUSINESS_TYPE_MODULES[type] ?? BUSINESS_TYPE_MODULES.mixed;
}
