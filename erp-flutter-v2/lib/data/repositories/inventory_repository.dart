import '../../core/supabase/supabase_bootstrap.dart';
import '../../core/utils/branch_id.dart';
import '../models/inventory_item.dart';

/// Stock levels from stock_movements (mirrors erp-mobile-app/src/api/inventory.ts).
class InventoryRepository {
  final _client = SupabaseBootstrap.client;

  Future<List<InventoryItem>> fetchInventory({
    required String companyId,
    String? branchId,
  }) async {
    final productsRes = await _client
        .from('products')
        .select(
          'id, name, sku, min_stock, retail_price, cost_price, has_variations, product_categories(name)',
        )
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');

    final products = List<Map<String, dynamic>>.from(productsRes as List);
    if (products.isEmpty) return [];

    final productIds = products.map((p) => p['id'].toString()).toList();
    final effectiveBranch = branchId != null ? safeRpcBranchId(branchId) : null;

    var movQuery = _client
        .from('stock_movements')
        .select('product_id, variation_id, quantity')
        .eq('company_id', companyId)
        .inFilter('product_id', productIds);

    if (effectiveBranch != null) {
      movQuery = movQuery.eq('branch_id', effectiveBranch);
    }

    final movements = List<Map<String, dynamic>>.from(await movQuery as List);
    final stockByKey = _stockMapFromMovements(movements);

    final withVariations =
        products.where((p) => p['has_variations'] == true).toList();
    final varProductIds =
        withVariations.map((p) => p['id'].toString()).toList();

    final varMap = <String, List<String>>{};
    if (varProductIds.isNotEmpty) {
      final varRows = await _client
          .from('product_variations')
          .select('id, product_id')
          .inFilter('product_id', varProductIds)
          .eq('is_active', true);
      for (final v in List<Map<String, dynamic>>.from(varRows as List)) {
        final pid = v['product_id'].toString();
        varMap.putIfAbsent(pid, () => []).add(v['id'].toString());
      }
    }

    return products.map((r) {
      final id = r['id'].toString();
      final hasVariations = r['has_variations'] == true;
      double stock;
      if (hasVariations) {
        final vars = varMap[id] ?? [];
        stock = vars.isEmpty
            ? 0
            : vars.fold<double>(
                0,
                (sum, vid) => sum + (stockByKey['${id}_$vid'] ?? 0),
              );
      } else {
        stock = stockByKey[id] ?? 0;
      }

      final pc = r['product_categories'];
      String? categoryName;
      if (pc is Map) {
        categoryName = pc['name']?.toString();
      } else if (pc is List && pc.isNotEmpty && pc.first is Map) {
        categoryName = (pc.first as Map)['name']?.toString();
      }

      return InventoryItem(
        id: id,
        sku: r['sku']?.toString() ?? '—',
        name: r['name']?.toString() ?? '—',
        stock: stock,
        minStock: (r['min_stock'] as num?)?.toDouble() ?? 0,
        retailPrice: (r['retail_price'] as num?)?.toDouble() ?? 0,
        costPrice: (r['cost_price'] as num?)?.toDouble() ?? 0,
        category: categoryName,
      );
    }).toList();
  }

  Map<String, double> _stockMapFromMovements(List<Map<String, dynamic>> rows) {
    final map = <String, double>{};
    for (final m in rows) {
      final pid = m['product_id'].toString();
      final vid = m['variation_id'];
      final key = vid != null ? '${pid}_$vid' : pid;
      map[key] = (map[key] ?? 0) + ((m['quantity'] as num?)?.toDouble() ?? 0);
    }
    return map;
  }

  /// Manual stock adjustment via stock_movements insert (adjustment type).
  Future<({bool success, String? error})> adjustStock({
    required String companyId,
    required String branchId,
    required String productId,
    required double quantityDelta,
    required String reason,
    String? userId,
  }) async {
    final effectiveBranch = safeRpcBranchId(branchId);
    if (effectiveBranch == null) {
      return (success: false, error: 'Select a valid branch.');
    }
    if (quantityDelta == 0) {
      return (success: false, error: 'Quantity change cannot be zero.');
    }

    try {
      await _client.from('stock_movements').insert({
        'company_id': companyId,
        'branch_id': effectiveBranch,
        'product_id': productId,
        'movement_type': 'adjustment',
        'quantity': quantityDelta,
        'reference_type': 'adjustment',
        'notes': reason.trim().isEmpty ? 'Mobile adjustment' : reason.trim(),
        'created_by': ?userId,
      });
      return (success: true, error: null);
    } catch (e) {
      return (success: false, error: e.toString());
    }
  }

  Future<List<Map<String, dynamic>>> fetchProductMovements({
    required String companyId,
    required String productId,
    String? branchId,
    int limit = 50,
  }) async {
    var query = _client
        .from('stock_movements')
        .select(
          'id, movement_type, quantity, unit_cost, total_cost, reference_type, reference_id, created_at, notes',
        )
        .eq('company_id', companyId)
        .eq('product_id', productId)
        .order('created_at', ascending: false)
        .limit(limit);

    final effectiveBranch = branchId != null ? safeRpcBranchId(branchId) : null;
    if (effectiveBranch != null) {
      query = query.eq('branch_id', effectiveBranch);
    }

    return List<Map<String, dynamic>>.from(await query as List);
  }
}
