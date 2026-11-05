class RolePermissionRow {
  const RolePermissionRow({
    required this.role,
    required this.module,
    required this.action,
    required this.allowed,
  });

  final String role;
  final String module;
  final String action;
  final bool allowed;

  factory RolePermissionRow.fromJson(Map<String, dynamic> json) {
    return RolePermissionRow(
      role: json['role'] as String? ?? '',
      module: json['module'] as String? ?? '',
      action: json['action'] as String? ?? '',
      allowed: json['allowed'] == true,
    );
  }
}
