// Aligned with erp-mobile-app/src/config/functionalRoles.ts

enum EngineRole { owner, admin, manager, user }

const _workerAliases = {
  'staff',
  'salesman',
  'cashier',
  'inventory',
  'viewer',
  'user',
  'salesperson',
  'inventory_clerk',
};

String normalizeAppRole(String? role) {
  final r = (role ?? 'salesman').toLowerCase().trim();
  if (r == 'owner') return 'owner';
  if (r == 'admin' || r == 'super admin' || r == 'superadmin') return 'admin';
  if (r == 'manager' || r == 'accountant') return 'manager';
  if (_workerAliases.contains(r)) return 'salesman';
  return 'salesman';
}

EngineRole mapAppRoleToEngineRole(String? role) {
  final r = normalizeAppRole(role);
  switch (r) {
    case 'owner':
      return EngineRole.owner;
    case 'admin':
      return EngineRole.admin;
    case 'manager':
      return EngineRole.manager;
    default:
      return EngineRole.user;
  }
}

bool isAdminOrOwnerAppRole(String? role) {
  final r = normalizeAppRole(role);
  return r == 'owner' || r == 'admin';
}

bool canViewFinancialBalances(String? role) {
  final r = normalizeAppRole(role);
  return r == 'owner' || r == 'admin' || r == 'manager';
}

bool canPickAllCompanyBranches(String? role) {
  final r = (role ?? '').toLowerCase();
  return r == 'admin' || r == 'owner';
}

String engineRoleToDbString(EngineRole role) {
  switch (role) {
    case EngineRole.owner:
      return 'owner';
    case EngineRole.admin:
      return 'admin';
    case EngineRole.manager:
      return 'manager';
    case EngineRole.user:
      return 'user';
  }
}

String functionalRoleLabel(String? appRole) {
  final r = normalizeAppRole(appRole);
  switch (r) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'manager':
      return 'Manager';
    default:
      return 'Worker / Salesman';
  }
}
