import '../../core/auth/functional_roles.dart';
import '../../core/supabase/supabase_bootstrap.dart';
import '../models/role_permission.dart';

class PermissionRepository {
  final _client = SupabaseBootstrap.client;

  Future<List<RolePermissionRow>> getRolePermissions(String appRole) async {
    final engineRole = mapAppRoleToEngineRole(appRole);
    final data = await _client
        .from('role_permissions')
        .select('role, module, action, allowed')
        .eq('role', engineRoleToDbString(engineRole))
        .order('module')
        .order('action');

    return (data as List)
        .map((row) => RolePermissionRow.fromJson(row as Map<String, dynamic>))
        .toList();
  }
}
