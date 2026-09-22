import 'dart:convert';

import '../../core/auth/functional_roles.dart';
import '../../core/supabase/supabase_bootstrap.dart';
import '../models/branch.dart';

class BranchRepository {
  final _client = SupabaseBootstrap.client;

  Future<List<Branch>> getBranches(String companyId) async {
    final data = await _client
        .from('branches')
        .select('id, company_id, name, code, address, city, is_active')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');

    return (data as List).map((row) {
      final map = row as Map<String, dynamic>;
      final address = map['address'] as String?;
      final city = map['city'] as String?;
      final code = map['code'] as String?;
      final location = [address, city]
          .where((e) => e != null && e.toString().isNotEmpty)
          .join(', ');
      return Branch(
        id: map['id'] as String,
        name: map['name'] as String? ?? 'Branch',
        location: location.isNotEmpty ? location : (code ?? '—'),
      );
    }).toList();
  }

  List<String> _parseAccessibleBranchIds(dynamic raw) {
    if (raw == null) return [];
    if (raw is String) {
      if (raw.startsWith('[')) {
        try {
          final decoded = jsonDecode(raw);
          return _parseAccessibleBranchIds(decoded);
        } catch (_) {
          return [];
        }
      }
      return raw.isNotEmpty ? [raw] : [];
    }
    if (raw is! List) return [];
    return raw
        .map((x) {
          if (x is String) return x;
          if (x is Map && x['id'] != null) return x['id'].toString();
          return x.toString();
        })
        .where((id) => id.isNotEmpty)
        .toSet()
        .toList();
  }

  Future<BranchAccessResult> _fetchUserBranchesDirect(
    String? authUserId,
    String? profileId,
  ) async {
    final uniqueIds = <String>{
      if (authUserId != null && authUserId.isNotEmpty) authUserId,
      if (profileId != null && profileId.isNotEmpty) profileId,
    };
    if (uniqueIds.isEmpty) {
      return const BranchAccessResult(
        branchIds: [],
        branchCount: 0,
        requiresBranchSelection: false,
      );
    }

    final filter = uniqueIds.length > 1
        ? 'user_id.eq.${uniqueIds.first},user_id.eq.${uniqueIds.skip(1).first}'
        : 'user_id.eq.${uniqueIds.first}';

    final data = await _client
        .from('user_branches')
        .select('branch_id, is_default')
        .or(filter);

    if ((data as List).isEmpty) {
      return const BranchAccessResult(
        branchIds: [],
        branchCount: 0,
        requiresBranchSelection: false,
      );
    }

    final branchIds = <String>{};
    String? effectiveId;
    final rows = List<dynamic>.from(data as List);
    for (final row in rows) {
      final map = Map<String, dynamic>.from(row as Map);
      final id = map['branch_id'] as String?;
      if (id != null) branchIds.add(id);
      if (map['is_default'] == true && id != null) effectiveId = id;
    }
    effectiveId ??= branchIds.isNotEmpty ? branchIds.first : null;

    return BranchAccessResult(
      branchIds: branchIds.toList(),
      branchCount: branchIds.length,
      effectiveBranchId: effectiveId,
      requiresBranchSelection: branchIds.length > 1 && effectiveId == null,
    );
  }

  Future<BranchAccessResult> getUserAssignedBranchIds(
    String? authUserId,
    String? profileId,
  ) async {
    return _fetchUserBranchesDirect(authUserId, profileId);
  }

  /// Mirrors erp-mobile-app/src/api/permissions.ts getUserAccessibleBranches.
  Future<BranchAccessResult> getUserAccessibleBranches({
    required String? authUserId,
    required String? profileId,
    required String? companyId,
    required String appRole,
  }) async {
    if (isAdminOrOwnerAppRole(appRole) && companyId != null) {
      final branches = await getBranches(companyId);
      return BranchAccessResult(
        branchIds: branches.map((b) => b.id).toList(),
        branchCount: branches.length,
        effectiveBranchId: branches.length == 1 ? branches.first.id : null,
        requiresBranchSelection: branches.length > 1,
      );
    }

    final direct = await _fetchUserBranchesDirect(authUserId, profileId);

    final lookupIds = <String>{
      if (authUserId != null && authUserId.isNotEmpty) authUserId,
      if (profileId != null && profileId.isNotEmpty) profileId,
    };

    var rpcBranchIds = <String>[];
    var effectiveBranchId = direct.effectiveBranchId;
    var requiresBranchSelection = direct.requiresBranchSelection;
    var branchCount = direct.branchCount;

    for (final lookupId in lookupIds) {
      final rpcData = await _client.rpc(
        'get_effective_user_branch',
        params: {'p_user_id': lookupId},
      );
      if (rpcData is Map<String, dynamic>) {
        branchCount = branchCount < (rpcData['branch_count'] as int? ?? 0)
            ? (rpcData['branch_count'] as int? ?? 0)
            : branchCount;
        rpcBranchIds = [
          ...rpcBranchIds,
          ..._parseAccessibleBranchIds(rpcData['accessible_branch_ids']),
        ];
        if (rpcData['effective_branch_id'] != null) {
          effectiveBranchId = rpcData['effective_branch_id'] as String;
        }
        if (rpcData['requires_branch_selection'] == true) {
          requiresBranchSelection = true;
        }
      }
    }

    var finalIds = <String>{
      ...rpcBranchIds,
      ...direct.branchIds,
    }.toList();

    if (finalIds.isEmpty && companyId != null) {
      final companyBranches = await getBranches(companyId);
      if (companyBranches.length == 1) {
        finalIds = [companyBranches.first.id];
        effectiveBranchId ??= companyBranches.first.id;
      }
    }

    return BranchAccessResult(
      branchIds: finalIds,
      branchCount: branchCount > finalIds.length ? branchCount : finalIds.length,
      effectiveBranchId: effectiveBranchId ??
          (finalIds.length == 1 ? finalIds.first : null),
      requiresBranchSelection:
          finalIds.length > 1 && (requiresBranchSelection || direct.requiresBranchSelection),
    );
  }
}
