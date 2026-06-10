import '../../features/auth/providers/permission_state.dart';

bool canCreatePurchase(PermissionState perms) {
  return perms.isAdminOrOwner || perms.hasPermission('purchase.create');
}

bool canFinalizePurchase(PermissionState perms) {
  return perms.isAdminOrOwner ||
      perms.hasPermission('purchase.create') ||
      perms.hasPermission('purchase.edit');
}
