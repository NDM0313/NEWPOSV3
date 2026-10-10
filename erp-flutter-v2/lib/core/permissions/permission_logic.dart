import '../../data/models/role_permission.dart';

const viewActions = ['view', 'view_own', 'view_branch', 'view_company'];

bool hasModuleAction(
  List<RolePermissionRow> perms,
  String module,
  String action,
) {
  final viewActionsForModule = action == 'view' ? viewActions : <String>[];
  return perms.any(
    (p) =>
        p.module == module &&
        (p.action == action ||
            (action == 'view' && viewActionsForModule.contains(p.action))) &&
        p.allowed,
  );
}

bool canViewModule(List<RolePermissionRow> perms, String module) {
  if (perms.isEmpty) return false;
  const viewActionsByModule = <String, List<String>>{
    'sales': viewActions,
    'purchase': viewActions,
    'pos': ['view', 'use'],
    'studio': viewActions,
    'rentals': viewActions,
    'reports': ['view'],
    'inventory': [...viewActions, 'adjust', 'transfer'],
    'ledger': [
      'view_full_accounting',
      'view_customer',
      'view_supplier',
      ...viewActions,
    ],
    'contacts': viewActions,
    'payments': ['receive', ...viewActions],
    'settings': ['modify'],
    'users': ['assign_permissions', 'create', 'edit', 'delete'],
  };
  final actions = viewActionsByModule[module] ?? viewActions;
  return actions.any(
    (a) => perms.any((p) => p.module == module && p.action == a && p.allowed),
  );
}

bool canUseFullAccounting(List<RolePermissionRow> perms, bool isAdminOrOwner) {
  if (isAdminOrOwner) return true;
  return hasModuleAction(perms, 'ledger', 'view_full_accounting');
}

bool canViewCustomerLedger(List<RolePermissionRow> perms, bool isAdminOrOwner) {
  if (canUseFullAccounting(perms, isAdminOrOwner)) return true;
  return hasModuleAction(perms, 'ledger', 'view_customer');
}

bool canViewSupplierLedger(List<RolePermissionRow> perms, bool isAdminOrOwner) {
  if (canUseFullAccounting(perms, isAdminOrOwner)) return true;
  return hasModuleAction(perms, 'ledger', 'view_supplier');
}

bool hasPermissionCode(
  List<RolePermissionRow> perms,
  String code,
  bool isAdminOrOwner,
) {
  if (isAdminOrOwner) return true;
  final parts = code.split('.');
  final module = parts.first;
  final action = parts.length > 1 ? parts[1] : 'view';
  return hasModuleAction(perms, module, action) ||
      (action == 'view' && canViewModule(perms, module));
}
