import '../../data/models/contact.dart';
import '../../features/auth/providers/permission_state.dart';

bool canShowContactBalances(PermissionState perms, ContactRoleFilter? listFilter) {
  if (!perms.canViewBalances) return false;
  if (listFilter == ContactRoleFilter.supplier) {
    return perms.canViewSupplierLedger;
  }
  if (listFilter == ContactRoleFilter.worker) {
    return perms.isAdminOrOwner || perms.canUseFullAccounting;
  }
  if (listFilter == ContactRoleFilter.customer) {
    return perms.canViewCustomerLedger;
  }
  return perms.canViewCustomerLedger ||
      perms.canViewSupplierLedger ||
      perms.canUseFullAccounting;
}

bool canShowContactBalance(PermissionState perms, Contact contact) {
  if (!perms.canViewBalances) return false;
  final type = (contact.type ?? '').toLowerCase();
  if (type == 'supplier' || contact.roles.contains(ContactRoleFilter.supplier)) {
    return perms.canViewSupplierLedger;
  }
  if (type == 'worker' || contact.roles.contains(ContactRoleFilter.worker)) {
    return perms.isAdminOrOwner || perms.canUseFullAccounting;
  }
  return perms.canViewCustomerLedger;
}
