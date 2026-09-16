import '../../../core/permissions/permission_logic.dart' as perm;
import '../../../core/permissions/permission_modules.dart';
import '../../../data/models/module_toggles.dart';
import '../../../data/models/role_permission.dart';

class PermissionState {
  const PermissionState({
    required this.permissions,
    required this.branchIds,
    required this.moduleToggles,
    required this.moduleConfigStatus,
    required this.isLoaded,
    required this.isAdminOrOwner,
    required this.isOwner,
    required this.canViewBalances,
    this.moduleConfigBanner,
  });

  final List<RolePermissionRow> permissions;
  final List<String> branchIds;
  final ModuleToggles moduleToggles;
  final ModuleConfigStatus moduleConfigStatus;
  final bool isLoaded;
  final bool isAdminOrOwner;
  final bool isOwner;
  final bool canViewBalances;
  final String? moduleConfigBanner;

  static const initial = PermissionState(
    permissions: [],
    branchIds: [],
    moduleToggles: ModuleToggles.defaults,
    moduleConfigStatus: ModuleConfigStatus.loading,
    isLoaded: false,
    isAdminOrOwner: false,
    isOwner: false,
    canViewBalances: false,
  );

  bool hasPermission(String code) {
    if (!isLoaded) return false;
    return perm.hasPermissionCode(permissions, code, isAdminOrOwner);
  }

  bool hasBranchAccess(String branchId) {
    if (!isLoaded) return false;
    if (isAdminOrOwner) return true;
    if (branchId.isEmpty) return false;
    return branchIds.contains(branchId);
  }

  bool isModuleEnabled(ErpScreen screen) {
    switch (screen) {
      case ErpScreen.rental:
        return moduleToggles.rentalModuleEnabled;
      case ErpScreen.studio:
        return moduleToggles.studioModuleEnabled;
      case ErpScreen.pos:
        return moduleToggles.posModuleEnabled;
      case ErpScreen.accounts:
        return moduleToggles.accountingModuleEnabled;
      default:
        return true;
    }
  }

  bool get canUseFullAccounting =>
      perm.canUseFullAccounting(permissions, isAdminOrOwner);

  bool get canViewCustomerLedger =>
      perm.canViewCustomerLedger(permissions, isAdminOrOwner);

  bool get canViewSupplierLedger =>
      perm.canViewSupplierLedger(permissions, isAdminOrOwner);

  bool canViewScreen(ErpScreen screen) {
    if (!isLoaded) return false;
    if (!isModuleEnabled(screen)) return false;
    if (screenSkipsModuleViewPermission(screen)) return true;

    if (screen == ErpScreen.ledger && !canUseFullAccounting) {
      final accountsModule = permissionModuleForScreen(ErpScreen.accounts);
      if (accountsModule != null && hasPermission('$accountsModule.view')) {
        return true;
      }
    }

    final module = permissionModuleForScreen(screen);
    if (module == null) return true;
    return hasPermission('$module.view');
  }

  static String? buildModuleConfigBanner(
    ModuleConfigStatus status,
    ModuleToggles toggles,
    bool isAdminOrOwner,
  ) {
    if (status == ModuleConfigStatus.noCompany) {
      return 'Company not linked to your account. Contact your administrator.';
    }
    if (status == ModuleConfigStatus.loadError) {
      return 'Could not load company modules. Check internet and try logging out and back in.';
    }
    final companyOff = !toggles.posModuleEnabled ||
        !toggles.rentalModuleEnabled ||
        !toggles.studioModuleEnabled ||
        !toggles.accountingModuleEnabled;
    if (status == ModuleConfigStatus.ok && companyOff && isAdminOrOwner) {
      return 'Some modules are off for this business. Turn them on in Web ERP → Settings.';
    }
    return null;
  }
}
