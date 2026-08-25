class UserProfile {
  const UserProfile({
    required this.authUserId,
    required this.name,
    required this.email,
    required this.role,
    required this.companyId,
    this.profileId,
    this.branchId,
    this.branchLocked = false,
  });

  final String authUserId;
  final String name;
  final String email;
  final String role;
  final String? companyId;
  final String? profileId;
  final String? branchId;
  final bool branchLocked;

  String get branchLookupId => profileId ?? authUserId;
}
