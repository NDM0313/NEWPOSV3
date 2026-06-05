/** Settings sidebar navigation — single source of truth for categories and content routing. */

export type SettingsContentKey =
  | 'company'
  | 'branches'
  | 'pos'
  | 'sales'
  | 'purchase'
  | 'inventory'
  | 'rental'
  | 'accounting'
  | 'accounts'
  | 'numbering'
  | 'printer'
  | 'printing'
  | 'invoiceTemplates'
  | 'users'
  | 'rolesPermissions'
  | 'modules'
  | 'leadTools'
  | 'employees'
  | 'systemHealth'
  | 'data'
  | 'developerTools'
  | 'accountingDeveloperCenter';

export type SettingsCategoryId =
  | 'general'
  | 'operations'
  | 'accountingFinance'
  | 'documentsPrinting'
  | 'usersAccess'
  | 'systemData';

export interface SettingsNavItem {
  id: string;
  label: string;
  contentKey: SettingsContentKey;
  /** Sub-section for InventoryMasters, NumberingPanel, PrintingSettingsPanel */
  subTabId?: string;
  requiresAdmin?: boolean;
  requiresDeveloper?: boolean;
  requiresAccountingDeveloperCenter?: boolean;
}

export interface SettingsCategory {
  id: SettingsCategoryId;
  label: string;
  description: string;
  items: SettingsNavItem[];
}

export const SETTINGS_NAV: SettingsCategory[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Company profile aur branches',
    items: [
      { id: 'company', label: 'Company', contentKey: 'company' },
      { id: 'branches', label: 'Branches', contentKey: 'branches' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    description: 'POS, sales, purchase, inventory aur rental defaults',
    items: [
      { id: 'pos', label: 'POS', contentKey: 'pos' },
      { id: 'salesRules', label: 'Sales Rules', contentKey: 'sales' },
      { id: 'purchaseRules', label: 'Purchase Rules', contentKey: 'purchase' },
      { id: 'inventoryGeneral', label: 'Inventory — General', contentKey: 'inventory', subTabId: 'general' },
      { id: 'inventoryUnits', label: 'Units', contentKey: 'inventory', subTabId: 'units' },
      { id: 'inventoryCategories', label: 'Categories', contentKey: 'inventory', subTabId: 'categories' },
      { id: 'inventorySubCategories', label: 'Sub-Categories', contentKey: 'inventory', subTabId: 'sub-categories' },
      { id: 'inventoryBrands', label: 'Brands', contentKey: 'inventory', subTabId: 'brands' },
      { id: 'inventoryVariations', label: 'Variations', contentKey: 'inventory', subTabId: 'variations' },
      { id: 'rental', label: 'Rental', contentKey: 'rental' },
    ],
  },
  {
    id: 'accountingFinance',
    label: 'Accounting & Finance',
    description: 'Fiscal year, default accounts, policies aur numbering',
    items: [
      { id: 'fiscalTax', label: 'Fiscal & Tax', contentKey: 'accounting' },
      { id: 'defaultAccounts', label: 'Default Accounts', contentKey: 'accounts' },
      { id: 'policies', label: 'Policies', contentKey: 'accounting' },
      { id: 'numberingRules', label: 'Numbering — Rules', contentKey: 'numbering', subTabId: 'rules', requiresAdmin: true },
      { id: 'numberingMaintenance', label: 'Numbering — Maintenance', contentKey: 'numbering', subTabId: 'maintenance', requiresAdmin: true },
      { id: 'numberingAudit', label: 'Numbering — Audit Log', contentKey: 'numbering', subTabId: 'audit', requiresAdmin: true },
      {
        id: 'accountingDeveloperCenter',
        label: 'Developer Center',
        contentKey: 'accountingDeveloperCenter',
        requiresAccountingDeveloperCenter: true,
      },
    ],
  },
  {
    id: 'documentsPrinting',
    label: 'Documents & Printing',
    description: 'Print layouts, templates aur legacy printer config',
    items: [
      { id: 'printingGeneral', label: 'Printing — General', contentKey: 'printing', subTabId: 'general' },
      { id: 'printingDocumentTemplates', label: 'Document Templates', contentKey: 'printing', subTabId: 'documentTemplates' },
      { id: 'printingPageSetup', label: 'Page Setup', contentKey: 'printing', subTabId: 'pageSetup' },
      { id: 'printingFields', label: 'Fields', contentKey: 'printing', subTabId: 'fields' },
      { id: 'printingLayoutEditor', label: 'Layout Editor', contentKey: 'printing', subTabId: 'layoutEditor' },
      { id: 'printingThermal', label: 'Thermal Print', contentKey: 'printing', subTabId: 'thermalPrint' },
      { id: 'printingPdfExport', label: 'PDF Export', contentKey: 'printing', subTabId: 'pdfExport' },
      { id: 'invoiceTemplates', label: 'Invoice Templates', contentKey: 'invoiceTemplates' },
      { id: 'legacyPrinter', label: 'Legacy Printer / Documents', contentKey: 'printer' },
    ],
  },
  {
    id: 'usersAccess',
    label: 'Users & Access',
    description: 'Users, roles aur employee payroll',
    items: [
      { id: 'users', label: 'Users', contentKey: 'users' },
      { id: 'rolesPermissions', label: 'Roles & Permissions', contentKey: 'rolesPermissions' },
      { id: 'employees', label: 'Employees', contentKey: 'employees' },
    ],
  },
  {
    id: 'systemData',
    label: 'System & Data',
    description: 'Modules, backup, health aur developer tools',
    items: [
      { id: 'modules', label: 'Module Toggles', contentKey: 'modules' },
      { id: 'backup', label: 'Backup & Restore', contentKey: 'data' },
      { id: 'systemHealth', label: 'System Health', contentKey: 'systemHealth', requiresAdmin: true },
      { id: 'leadTools', label: 'Lead Tools', contentKey: 'leadTools', requiresDeveloper: true },
      { id: 'developerTools', label: 'Developer Tools', contentKey: 'developerTools', requiresDeveloper: true },
    ],
  },
];

export interface ResolvedSettingsNav {
  categories: SettingsCategory[];
  defaultCategoryId: SettingsCategoryId;
  defaultItemId: string;
}

export function getVisibleSettingsNav(
  isAdminOrOwner: boolean,
  canDeveloperTools: boolean,
  canAccountingDeveloperCenter = false,
): ResolvedSettingsNav {
  const categories: SettingsCategory[] = [];

  for (const category of SETTINGS_NAV) {
    const items = category.items.filter((item) => {
      if (item.requiresAdmin && !isAdminOrOwner) return false;
      if (item.requiresDeveloper && !canDeveloperTools) return false;
      if (item.requiresAccountingDeveloperCenter && !canAccountingDeveloperCenter) return false;
      return true;
    });
    if (items.length > 0) {
      categories.push({ ...category, items });
    }
  }

  const defaultCategoryId = categories[0]?.id ?? 'general';
  const defaultItemId = categories[0]?.items[0]?.id ?? 'company';

  return { categories, defaultCategoryId, defaultItemId };
}

export function findNavItem(
  categories: SettingsCategory[],
  categoryId: SettingsCategoryId,
  itemId: string,
): SettingsNavItem | null {
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return null;
  return category.items.find((i) => i.id === itemId) ?? category.items[0] ?? null;
}

export function parseSettingsHash(): { categoryId: SettingsCategoryId; itemId: string } | null {
  if (typeof window === 'undefined') return null;
  const raw = window.location.hash.replace(/^#/, '').trim();
  if (!raw.startsWith('settings/')) return null;
  const parts = raw.slice('settings/'.length).split('/').filter(Boolean);
  if (parts.length < 2) return null;
  return { categoryId: parts[0] as SettingsCategoryId, itemId: parts[1] };
}

export function writeSettingsHash(categoryId: SettingsCategoryId, itemId: string): void {
  if (typeof window === 'undefined') return;
  const next = `#settings/${categoryId}/${itemId}`;
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', next);
  }
}
