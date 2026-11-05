import '../../features/auth/providers/auth_session_provider.dart';
import '../../features/auth/providers/permission_state.dart';
import '../utils/branch_id.dart';

/// Resolved company / branch from the authenticated session.
class SessionScope {
  const SessionScope({
    required this.companyId,
    required this.branchId,
    required this.permissions,
    required this.authUserId,
    required this.profileId,
    required this.role,
  });

  final String companyId;
  final String? branchId;
  final PermissionState permissions;
  final String authUserId;
  final String profileId;
  final String role;

  static SessionScope? from(AuthSessionState session) {
    final profile = session.profile;
    final companyId = profile?.companyId;
    if (profile == null || companyId == null) return null;
    return SessionScope(
      companyId: companyId,
      branchId: session.selectedBranch?.id,
      permissions: session.permissions,
      authUserId: profile.authUserId,
      profileId: profile.branchLookupId,
      role: profile.role,
    );
  }

  /// Branch filter for list queries — selected branch, or accessible set for workers.
  String? get listBranchId {
    if (branchId != null && isRealBranchUuid(branchId)) return branchId;
    return null;
  }

  List<String>? get accessibleBranchIds {
    if (permissions.isAdminOrOwner) return null;
    if (listBranchId != null) return null;
    if (permissions.branchIds.isEmpty) return null;
    return permissions.branchIds;
  }
}
