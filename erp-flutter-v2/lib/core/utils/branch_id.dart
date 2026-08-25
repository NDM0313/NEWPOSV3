final _branchUuidRe = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  caseSensitive: false,
);

/// Mirrors erp-mobile-app contactBalancesRpc.safeRpcBranchId
String? safeRpcBranchId(String? branchId) {
  if (branchId == null ||
      branchId.isEmpty ||
      branchId == 'all' ||
      branchId == 'default') {
    return null;
  }
  final trimmed = branchId.trim();
  return _branchUuidRe.hasMatch(trimmed) ? trimmed : null;
}

bool isRealBranchUuid(String? branchId) {
  if (branchId == null || branchId.isEmpty) return false;
  return _branchUuidRe.hasMatch(branchId.trim());
}
