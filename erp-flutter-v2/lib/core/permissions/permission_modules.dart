// Screen → role_permissions.module mapping (erp-mobile-app/src/utils/permissionModules.ts)

enum ErpScreen {
  login,
  branchSelection,
  home,
  dashboard,
  sales,
  purchase,
  rental,
  studio,
  accounts,
  expense,
  inventory,
  products,
  pos,
  contacts,
  reports,
  packing,
  ledger,
  settings,
}

const Map<ErpScreen, String> screenToPermissionModule = {
  ErpScreen.sales: 'sales',
  ErpScreen.purchase: 'purchase',
  ErpScreen.pos: 'pos',
  ErpScreen.rental: 'rentals',
  ErpScreen.studio: 'studio',
  ErpScreen.accounts: 'ledger',
  ErpScreen.expense: 'payments',
  ErpScreen.products: 'inventory',
  ErpScreen.inventory: 'inventory',
  ErpScreen.contacts: 'contacts',
  ErpScreen.reports: 'reports',
  ErpScreen.packing: 'sales',
  ErpScreen.ledger: 'ledger',
  ErpScreen.settings: 'settings',
  ErpScreen.dashboard: 'reports',
  ErpScreen.home: 'reports',
};

String? permissionModuleForScreen(ErpScreen screen) =>
    screenToPermissionModule[screen];

bool screenSkipsModuleViewPermission(ErpScreen screen) =>
    screen == ErpScreen.settings;
