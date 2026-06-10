import '../../features/auth/providers/permission_state.dart';

bool canCreateRental(PermissionState perms) {
  return perms.isAdminOrOwner || perms.hasPermission('rentals.create');
}
