import '../../features/auth/providers/permission_state.dart';

bool canManageStudio(PermissionState perms) {
  return perms.isAdminOrOwner || perms.hasPermission('studio.edit');
}

bool canCompleteStudioStage(PermissionState perms) {
  return canManageStudio(perms) || perms.hasPermission('studio.create');
}
