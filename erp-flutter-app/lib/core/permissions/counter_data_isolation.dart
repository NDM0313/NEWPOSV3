import '../../features/auth/providers/permission_state.dart';

/// Mirrors erp-mobile-app/src/lib/counterDataIsolation.ts
bool shouldIsolateCounterWorkerData(String role) {
  final r = role.toLowerCase();
  return r == 'worker' || r == 'salesman';
}

String? _normalizeId(dynamic value) {
  if (value is! String) return null;
  final trimmed = value.trim();
  return trimmed.isEmpty ? null : trimmed.toLowerCase();
}

Set<String> _workerIdentityIds(String authUserId, String? profileId) {
  final ids = <String>{};
  final auth = _normalizeId(authUserId);
  if (auth != null) ids.add(auth);
  final profile = _normalizeId(profileId);
  if (profile != null) ids.add(profile);
  return ids;
}

Set<String> _rowCreatorIds(Map<String, dynamic> row) {
  final ids = <String>{};
  for (final key in [
    'created_by_id',
    'created_by',
    'user_id',
    'paid_to_user_id',
    'salesman_id',
  ]) {
    final normalized = _normalizeId(row[key]);
    if (normalized != null) ids.add(normalized);
  }
  return ids;
}

bool rowBelongsToCounterWorker(
  Map<String, dynamic> row,
  String authUserId,
  String? profileId,
) {
  final workerIds = _workerIdentityIds(authUserId, profileId);
  if (workerIds.isEmpty) return false;
  final creators = _rowCreatorIds(row);
  for (final id in creators) {
    if (workerIds.contains(id)) return true;
  }
  return false;
}

bool shouldIsolateSalesList(PermissionState perms, String role) {
  if (perms.isAdminOrOwner) return false;
  if (perms.hasPermission('sales.view_company') ||
      perms.hasPermission('sales.view_branch')) {
    return false;
  }
  return perms.hasPermission('sales.view_own') ||
      shouldIsolateCounterWorkerData(role);
}

bool shouldIsolatePurchaseList(PermissionState perms, String role) {
  if (perms.isAdminOrOwner) return false;
  if (perms.hasPermission('purchase.view_company') ||
      perms.hasPermission('purchase.view_branch')) {
    return false;
  }
  return perms.hasPermission('purchase.view_own') ||
      shouldIsolateCounterWorkerData(role);
}
