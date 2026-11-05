import '../../features/auth/providers/permission_state.dart';

bool canCreatePurchase(PermissionState perms) {
  return perms.isAdminOrOwner || perms.hasPermission('purchase.create');
}

bool canFinalizePurchase(PermissionState perms) {
  return perms.isAdminOrOwner ||
      perms.hasPermission('purchase.create') ||
      perms.hasPermission('purchase.edit');
}

bool canCancelPurchase(PermissionState perms) {
  return perms.isAdminOrOwner ||
      perms.hasPermission('purchase.delete') ||
      perms.hasPermission('purchase.edit');
}

bool isPurchaseStatusCancellable(String status) {
  final s = status.toLowerCase();
  return s != 'cancelled' && s != 'voided';
}
