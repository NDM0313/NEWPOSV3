/**
 * Single source of truth: Create Business Wizard ↔ Settings ↔ modules_config ↔ RPC bootstrap.
 * Import this instead of duplicating module ids or settings keys in wizard/settings/sidebar.
 */

export type BootstrapSurface = 'wizard' | 'settings' | 'rpc' | 'sidebar' | 'permissions_only';

export type ModuleDbEffect = 'modules_config' | 'placeholder';

/** Keys on SettingsContext ModuleToggles (camelCase *ModuleEnabled). */
export type ModuleToggleKey =
  | 'salesModuleEnabled'
  | 'purchasesModuleEnabled'
  | 'rentalModuleEnabled'
  | 'studioModuleEnabled'
  | 'accountingModuleEnabled'
  | 'productionModuleEnabled'
  | 'posModuleEnabled'
  | 'expensesModuleEnabled'
  | 'payrollModuleEnabled'
  | 'reportsModuleEnabled'
  | 'combosEnabled';

export interface ModuleRegistryEntry {
  /** Wizard checkbox id and modules_config.module_name */
  moduleName: string;
  settingsKey: ModuleToggleKey;
  label: string;
  description: string;
  inWizard: boolean;
  inSettingsToggles: boolean;
  sidebarGated: boolean;
  dbEffect: ModuleDbEffect;
  /** Shown in gap matrix notes */
  notes?: string;
}

export interface CompanyFieldRegistryEntry {
  id: string;
  label: string;
  wizardStep?: number;
  settingsTab?: string;
  settingsKey?: string;
  rpcParam?: string;
  companiesColumn?: string;
  surfaces: BootstrapSurface[];
}

export const MODULE_REGISTRY: ModuleRegistryEntry[] = [
  {
    moduleName: 'sales',
    settingsKey: 'salesModuleEnabled',
    label: 'Sales',
    description: 'Create invoices and manage customers',
    inWizard: true,
    inSettingsToggles: true,
    sidebarGated: true,
    dbEffect: 'modules_config',
  },
  {
    moduleName: 'purchases',
    settingsKey: 'purchasesModuleEnabled',
    label: 'Purchases',
    description: 'Track supplier purchases',
    inWizard: true,
    inSettingsToggles: true,
    sidebarGated: true,
    dbEffect: 'modules_config',
  },
  {
    moduleName: 'rentals',
    settingsKey: 'rentalModuleEnabled',
    label: 'Rentals',
    description: 'Manage rental bookings and returns',
    inWizard: true,
    inSettingsToggles: true,
    sidebarGated: true,
    dbEffect: 'modules_config',
  },
  {
    moduleName: 'pos',
    settingsKey: 'posModuleEnabled',
    label: 'POS',
    description: 'Point of sale and quick checkout',
    inWizard: true,
    inSettingsToggles: true,
    sidebarGated: true,
    dbEffect: 'modules_config',
  },
  {
    moduleName: 'studio',
    settingsKey: 'studioModuleEnabled',
    label: 'Studio Production',
    description: 'Orders and production stages',
    inWizard: true,
    inSettingsToggles: true,
    sidebarGated: true,
    dbEffect: 'modules_config',
  },
  {
    moduleName: 'production',
    settingsKey: 'productionModuleEnabled',
    label: 'Production',
    description: 'Advanced production workflows (BOM, orders)',
    inWizard: true,
    inSettingsToggles: true,
    sidebarGated: true,
    dbEffect: 'modules_config',
    notes: 'Manufacturing nav group; often enabled with studio',
  },
  {
    moduleName: 'accounting',
    settingsKey: 'accountingModuleEnabled',
    label: 'Accounting',
    description: 'Financial reporting and ledgers',
    inWizard: true,
    inSettingsToggles: true,
    sidebarGated: true,
    dbEffect: 'modules_config',
  },
  {
    moduleName: 'expenses',
    settingsKey: 'expensesModuleEnabled',
    label: 'Expenses',
    description: 'Record and track expenses',
    inWizard: true,
    inSettingsToggles: true,
    sidebarGated: true,
    dbEffect: 'modules_config',
  },
  {
    moduleName: 'payroll',
    settingsKey: 'payrollModuleEnabled',
    label: 'Payroll',
    description: 'Worker payments (future)',
    inWizard: true,
    inSettingsToggles: true,
    sidebarGated: false,
    dbEffect: 'placeholder',
    notes: 'Stored in modules_config; no dedicated sidebar route yet',
  },
  {
    moduleName: 'reports',
    settingsKey: 'reportsModuleEnabled',
    label: 'Reports',
    description: 'Analytics and reports',
    inWizard: true,
    inSettingsToggles: true,
    sidebarGated: true,
    dbEffect: 'modules_config',
    notes: 'Gates Reports nav; still requires reports.view permission',
  },
  {
    moduleName: 'combos',
    settingsKey: 'combosEnabled',
    label: 'Product combos',
    description: 'Bundle / combo products in inventory',
    inWizard: false,
    inSettingsToggles: true,
    sidebarGated: false,
    dbEffect: 'modules_config',
    notes: 'Settings-only; inventory feature flag companion',
  },
];

/** Default modules per business type (wizard step 4). */
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

/** Wizard step-4 module cards (subset with UI metadata lives in CreateBusinessWizard for icons). */
export const WIZARD_MODULE_IDS = MODULE_REGISTRY.filter((m) => m.inWizard).map((m) => m.moduleName);

export const SETTINGS_KEY_TO_MODULE_NAME: Record<ModuleToggleKey, string> = Object.fromEntries(
  MODULE_REGISTRY.map((m) => [m.settingsKey, m.moduleName])
) as Record<ModuleToggleKey, string>;

export const MODULE_NAME_TO_SETTINGS_KEY: Record<string, ModuleToggleKey> = Object.fromEntries(
  MODULE_REGISTRY.map((m) => [m.moduleName, m.settingsKey])
) as Record<string, ModuleToggleKey>;

/** Non-module company bootstrap fields (wizard ↔ settings ↔ RPC). */
export const COMPANY_FIELD_REGISTRY: CompanyFieldRegistryEntry[] = [
  { id: 'businessName', label: 'Business name', wizardStep: 1, settingsTab: 'company', companiesColumn: 'name', surfaces: ['wizard', 'settings', 'rpc'] },
  { id: 'businessType', label: 'Business type', wizardStep: 1, settingsTab: 'company', companiesColumn: 'business_type', rpcParam: 'p_business_type', surfaces: ['wizard', 'settings', 'rpc'] },
  { id: 'phone', label: 'Phone', wizardStep: 1, settingsTab: 'company', companiesColumn: 'phone', rpcParam: 'p_phone', surfaces: ['wizard', 'settings', 'rpc'] },
  { id: 'address', label: 'Address', wizardStep: 1, settingsTab: 'company', companiesColumn: 'address', rpcParam: 'p_address', surfaces: ['wizard', 'settings', 'rpc'] },
  { id: 'country', label: 'Country', wizardStep: 1, settingsTab: 'company', companiesColumn: 'country', rpcParam: 'p_country', surfaces: ['wizard', 'settings', 'rpc'] },
  { id: 'timezone', label: 'Timezone', wizardStep: 1, settingsTab: 'company', companiesColumn: 'timezone', rpcParam: 'p_timezone', surfaces: ['wizard', 'settings', 'rpc'] },
  { id: 'currency', label: 'Currency', wizardStep: 2, settingsTab: 'accounting', settingsKey: 'accounting_settings.defaultCurrency', rpcParam: 'p_currency', surfaces: ['wizard', 'settings', 'rpc'] },
  { id: 'fiscalYearStart', label: 'Fiscal year start', wizardStep: 2, settingsTab: 'accounting', settingsKey: 'accounting_settings.fiscalYearStart', rpcParam: 'p_fiscal_year_start', surfaces: ['wizard', 'settings', 'rpc'] },
  { id: 'fiscalYearEnd', label: 'Fiscal year end', wizardStep: 2, settingsTab: 'accounting', settingsKey: 'accounting_settings.fiscalYearEnd', rpcParam: 'p_fiscal_year_end', surfaces: ['wizard', 'settings', 'rpc'] },
  { id: 'accountingMethod', label: 'Accounting method', wizardStep: 2, settingsTab: 'accounting', settingsKey: 'accounting_settings.accountingMethod', rpcParam: 'p_accounting_method', surfaces: ['wizard', 'settings', 'rpc'] },
  { id: 'taxMode', label: 'Tax mode', wizardStep: 2, settingsTab: 'accounting', settingsKey: 'accounting_settings.taxCalculationMethod', rpcParam: 'p_tax_mode', surfaces: ['wizard', 'settings', 'rpc'] },
  { id: 'defaultTaxRate', label: 'Default tax rate', wizardStep: 2, settingsTab: 'accounting', settingsKey: 'accounting_settings.defaultTaxRate', rpcParam: 'p_default_tax_rate', surfaces: ['wizard', 'settings', 'rpc'] },
  { id: 'costingMethod', label: 'Valuation method', wizardStep: 3, settingsTab: 'inventory', settingsKey: 'inventory_settings.valuationMethod', rpcParam: 'p_costing_method', surfaces: ['wizard', 'settings', 'rpc'] },
  { id: 'allowNegativeStock', label: 'Negative stock', wizardStep: 3, settingsTab: 'inventory', settingsKey: 'inventory_settings.negativeStockAllowed', rpcParam: 'p_allow_negative_stock', surfaces: ['wizard', 'settings', 'rpc'] },
  { id: 'defaultUnit', label: 'Default unit', wizardStep: 3, settingsTab: 'inventory', settingsKey: 'inventory_settings.defaultUnitId', rpcParam: 'p_default_unit', surfaces: ['wizard', 'settings', 'rpc'] },
  { id: 'branchName', label: 'Branch name', wizardStep: 5, settingsTab: 'branches', rpcParam: 'p_branch_name', surfaces: ['wizard', 'settings', 'rpc'] },
  { id: 'branchCode', label: 'Branch code', wizardStep: 5, settingsTab: 'branches', rpcParam: 'p_branch_code', surfaces: ['wizard', 'settings', 'rpc'] },
  { id: 'branchCity', label: 'Branch city', wizardStep: 5, settingsTab: 'branches', rpcParam: 'p_branch_city', surfaces: ['wizard', 'settings', 'rpc'] },
  { id: 'branchState', label: 'Branch state', wizardStep: 5, settingsTab: 'branches', rpcParam: 'p_branch_state', surfaces: ['wizard', 'settings', 'rpc'] },
];

export interface ModuleToggles {
  salesModuleEnabled: boolean;
  purchasesModuleEnabled: boolean;
  rentalModuleEnabled: boolean;
  studioModuleEnabled: boolean;
  accountingModuleEnabled: boolean;
  productionModuleEnabled: boolean;
  posModuleEnabled: boolean;
  expensesModuleEnabled: boolean;
  payrollModuleEnabled: boolean;
  reportsModuleEnabled: boolean;
  combosEnabled: boolean;
}

export function defaultModuleToggles(): ModuleToggles {
  return {
    salesModuleEnabled: false,
    purchasesModuleEnabled: false,
    rentalModuleEnabled: false,
    studioModuleEnabled: false,
    accountingModuleEnabled: false,
    productionModuleEnabled: false,
    posModuleEnabled: false,
    expensesModuleEnabled: false,
    payrollModuleEnabled: false,
    reportsModuleEnabled: false,
    combosEnabled: false,
  };
}
