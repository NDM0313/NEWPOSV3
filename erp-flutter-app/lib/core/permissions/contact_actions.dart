import '../../features/auth/providers/permission_state.dart';

bool canCreateContact(PermissionState perms) {
  return perms.isAdminOrOwner || perms.hasPermission('contacts.create');
}
