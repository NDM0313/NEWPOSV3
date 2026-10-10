/** Settings sidebar navigation — single source of truth for categories and content routing. */

export type SettingsContentKey =
  | 'company'
  | 'appearance'
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
      { id: 'appearance', label: 'Appearance', contentKey: 'appearance' },
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
      { id: 'printingA4', label: 'A4 Documents', contentKey: 'printing', subTabId: 'a4Documents' },
      { id: 'printingThermal', label: 'Thermal Receipts', contentKey: 'printing', subTabId: 'thermalReceipts' },
      { id: 'printingReports', label: 'Reports & Export', contentKey: 'printing', subTabId: 'reportsExport' },
      { id: 'printingAdvanced', label: 'Advanced', contentKey: 'printing', subTabId: 'advanced' },
    ],
  },
  {
    id: 'usersAccess',
    label: 'Users & Access',
    description: 'Users, roles aur staff payroll settings',
    items: [
      { id: 'users', label: 'Users', contentKey: 'users' },
      { id: 'rolesPermissions', label: 'Roles & Permissions', contentKey: 'rolesPermissions' },
      { id: 'employees', label: 'Staff & Payroll', contentKey: 'employees' },
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

export type SettingsSearchHit = {
  categoryId: SettingsCategoryId;
  itemId: string;
  label: string;
  categoryLabel: string;
  /** Why it matched (optional subtitle) */
  matchHint?: string;
};

type RankedSettingsSearchHit = SettingsSearchHit & { score: number };

/** Deep keywords for in-page settings that are not separate nav rows. */
export const SETTINGS_SEARCH_KEYWORDS: {
  keywords: string[];
  categoryId: SettingsCategoryId;
  itemId: string;
  label: string;
}[] = [
  {
    keywords: ['packing', 'add packing', 'addpacking', 'enable packing', 'boxes', 'pieces', 'thaans'],
    categoryId: 'operations',
    itemId: 'inventoryGeneral',
    label: 'Enable Packing (Boxes / Pieces)',
  },
  {
    keywords: ['multi currency', 'multicurrency', 'fx', 'rmb', 'cny', 'active currencies'],
    categoryId: 'accountingFinance',
    itemId: 'fiscalTax',
    label: 'Multi Currency Enabled',
  },
];

function normalizeSearchQuery(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** Compact form for matching "addpacking" against "add packing". */
function compactQuery(q: string): string {
  return q.replace(/\s+/g, '');
}

/**
 * Search visible settings nav + keyword index.
 * Keyword hits rank above plain nav label matches. Cap 12.
 */
export function searchSettingsNav(
  categories: SettingsCategory[],
  query: string,
): SettingsSearchHit[] {
  const q = normalizeSearchQuery(query);
  if (!q) return [];
  const qCompact = compactQuery(q);

  const byItemId = new Map<string, RankedSettingsSearchHit>();
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const upsert = (hit: RankedSettingsSearchHit) => {
    const existing = byItemId.get(hit.itemId);
    if (!existing || hit.score > existing.score) {
      byItemId.set(hit.itemId, hit);
    } else if (existing && hit.matchHint && !existing.matchHint) {
      byItemId.set(hit.itemId, { ...existing, matchHint: hit.matchHint, label: hit.label });
    }
  };

  for (const entry of SETTINGS_SEARCH_KEYWORDS) {
    const category = categoryById.get(entry.categoryId);
    if (!category?.items.some((i) => i.id === entry.itemId)) continue;

    let score = 0;
    for (const kw of entry.keywords) {
      const kwN = normalizeSearchQuery(kw);
      const kwC = compactQuery(kwN);
      if (q === kwN || qCompact === kwC) score = Math.max(score, 100);
      else if (kwN.includes(q) || q.includes(kwN) || kwC.includes(qCompact) || qCompact.includes(kwC)) {
        score = Math.max(score, 80);
      }
    }
    if (score > 0) {
      upsert({
        categoryId: entry.categoryId,
        itemId: entry.itemId,
        label: entry.label,
        categoryLabel: category.label,
        matchHint: `In ${category.items.find((i) => i.id === entry.itemId)?.label ?? entry.itemId}`,
        score,
      });
    }
  }

  for (const category of categories) {
    const catLabel = category.label.toLowerCase();
    const catDesc = category.description.toLowerCase();
    for (const item of category.items) {
      const itemLabel = item.label.toLowerCase();
      let score = 0;
      if (itemLabel === q) score = 70;
      else if (itemLabel.includes(q) || compactQuery(itemLabel).includes(qCompact)) score = 60;
      else if (catLabel.includes(q) || catDesc.includes(q)) score = 40;
      if (score > 0) {
        upsert({
          categoryId: category.id,
          itemId: item.id,
          label: item.label,
          categoryLabel: category.label,
          score,
        });
      }
    }
  }

  return Array.from(byItemId.values())
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, 12)
    .map(({ score: _score, ...rest }) => rest);
}

