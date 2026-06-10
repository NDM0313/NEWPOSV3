import '../../features/auth/providers/permission_state.dart';

bool canCreateProduct(PermissionState perms) {
  return perms.isAdminOrOwner ||
      perms.hasPermission('inventory.create') ||
      perms.hasPermission('inventory.adjust');
}
