import '../../features/auth/providers/permission_state.dart';

bool canCreateExpense(PermissionState perms) {
  return perms.isAdminOrOwner ||
      perms.hasPermission('payments.create') ||
      perms.hasPermission('payments.pay');
}
