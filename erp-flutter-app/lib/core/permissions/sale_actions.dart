import '../../features/auth/providers/permission_state.dart';

bool canCreateSale(PermissionState perms) {
  return perms.isAdminOrOwner || perms.hasPermission('sales.create');
}

bool canFinalizeSale(PermissionState perms) {
  return perms.isAdminOrOwner ||
      perms.hasPermission('sales.create') ||
      perms.hasPermission('sales.edit');
}

bool canReceiveSalePayment(PermissionState perms) {
  return perms.isAdminOrOwner || perms.hasPermission('payments.receive');
}

bool canEditSale(PermissionState perms) {
  return perms.isAdminOrOwner ||
      perms.hasPermission('sales.edit') ||
      perms.hasPermission('sales.create');
}

bool canCancelSale(PermissionState perms) {
  return perms.isAdminOrOwner ||
      perms.hasPermission('sales.delete') ||
      perms.hasPermission('sales.edit');
}

bool isSaleStatusCancellable(String status) {
  final s = status.toLowerCase();
  return s == 'final' || s == 'order' || s == 'draft';
}

bool canCreateSaleReturn(PermissionState perms) {
  return perms.isAdminOrOwner ||
      perms.hasPermission('sales.edit') ||
      perms.hasPermission('sales.create');
}
