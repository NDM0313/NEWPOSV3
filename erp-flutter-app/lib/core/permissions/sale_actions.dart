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
