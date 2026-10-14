class Branch {
  const Branch({
    required this.id,
    required this.name,
    required this.location,
  });

  final String id;
  final String name;
  final String location;
}

class BranchAccessResult {
  const BranchAccessResult({
    required this.branchIds,
    required this.branchCount,
    this.effectiveBranchId,
    required this.requiresBranchSelection,
  });

  final List<String> branchIds;
  final int branchCount;
  final String? effectiveBranchId;
  final bool requiresBranchSelection;
}
