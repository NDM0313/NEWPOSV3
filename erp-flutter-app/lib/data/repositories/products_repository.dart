import '../../core/supabase/supabase_bootstrap.dart';
import '../../core/utils/branch_id.dart';
import '../local/list_cache_store.dart';
import '../models/product.dart';

const _productsSelect =
    'id, company_id, name, sku, barcode, description, cost_price, retail_price, wholesale_price, min_stock, is_active, has_variations, product_categories(name), units(name)';

class ProductsRepository {
  final _client = SupabaseBootstrap.client;
  final _listCache = ListCacheStore();

  Future<Map<String, double>> _fetchStockByProductId({
    required String companyId,
    required List<String> productIds,
    String? branchId,
  }) async {
    if (productIds.isEmpty) return {};
    final stock = <String, double>{};
    try {
      var query = _client
          .from('stock_movements')
          .select('product_id, quantity, branch_id')
          .eq('company_id', companyId)
          .inFilter('product_id', productIds);

      final data = await query;
      final branch = safeRpcBranchId(branchId);
      for (final row in data as List) {
        if (row is! Map) continue;
        final map = Map<String, dynamic>.from(row);
        final pid = map['product_id']?.toString();
        if (pid == null) continue;
        final rowBranch = map['branch_id']?.toString();
        if (branch != null) {
          if (rowBranch != null && rowBranch != branch) continue;
        }
        stock[pid] = (stock[pid] ?? 0) + _num(map['quantity']);
      }
    } catch (_) {
      // RLS may hide stock — return empty map
    }
    return stock;
  }

  Future<({List<Product> products, String? error})> getProducts({
    required String companyId,
    String? branchId,
    bool includeStock = true,
  }) async {
    try {
      final data = await _client
          .from('products')
          .select(_productsSelect)
          .eq('company_id', companyId)
          .order('name');

      var rows = (data as List).map((r) => Map<String, dynamic>.from(r as Map)).toList();
      await _listCache.putProducts(companyId, rows);

      if (branchId != null && isRealBranchUuid(branchId)) {
        rows = await _filterForBranch(companyId, branchId, rows);
      }

      final simpleIds = rows
          .where((r) => r['has_variations'] != true)
          .map((r) => r['id'] as String)
          .toList();

      final stockMap = includeStock
          ? await _fetchStockByProductId(
              companyId: companyId,
              productIds: simpleIds,
              branchId: branchId,
            )
          : <String, double>{};

      final products = rows.map((row) => _mapRow(row, stockMap)).toList();
      return (products: products, error: null);
    } catch (e) {
      final cached = await _listCache.getProducts(companyId);
      if (cached == null || cached.isEmpty) {
        return (products: <Product>[], error: e.toString());
      }

      var rows = cached;
      if (branchId != null && isRealBranchUuid(branchId)) {
        try {
          rows = await _filterForBranch(companyId, branchId, rows);
        } catch (_) {
          // Branch filter may fail offline — show unfiltered cache
        }
      }

      final products = rows.map((row) => _mapRow(row, {})).toList();
      return (products: products, error: 'Offline — showing cached products.');
    }
  }

  Product? findByBarcodeOrSku(List<Product> products, String code) {
    final q = code.trim().toLowerCase();
    if (q.isEmpty) return null;
    for (final p in products) {
      if (p.sku.toLowerCase() == q) return p;
      if (p.barcode != null && p.barcode!.trim().toLowerCase() == q) return p;
    }
    return null;
  }

  Future<({Product? product, String? error})> getProductById({
    required String companyId,
    required String productId,
    String? branchId,
    bool includeStock = true,
  }) async {
    final row = await _client
        .from('products')
        .select(_productsSelect)
        .eq('company_id', companyId)
        .eq('id', productId)
        .maybeSingle();

    if (row == null) {
      return (product: null, error: 'Product not found or access denied.');
    }

    final map = Map<String, dynamic>.from(row);
    final stockMap = includeStock && map['has_variations'] != true
        ? await _fetchStockByProductId(
            companyId: companyId,
            productIds: [productId],
            branchId: branchId,
          )
        : <String, double>{};

    return (product: _mapRow(map, stockMap), error: null);
  }

  Future<List<Map<String, dynamic>>> _filterForBranch(
    String companyId,
    String branchId,
    List<Map<String, dynamic>> rows,
  ) async {
    try {
      final data = await _client
          .from('product_branches')
          .select('product_id, branch_id')
          .eq('company_id', companyId);

      final restrictions = <String, Set<String>>{};
      for (final row in data as List) {
        if (row is! Map) continue;
        final map = Map<String, dynamic>.from(row);
        final pid = map['product_id'] as String?;
        final bid = map['branch_id'] as String?;
        if (pid == null || bid == null) continue;
        restrictions.putIfAbsent(pid, () => {}).add(bid);
      }
      if (restrictions.isEmpty) return rows;
      return rows.where((r) {
        final allowed = restrictions[r['id'] as String];
        if (allowed == null) return true;
        return allowed.contains(branchId);
      }).toList();
    } catch (_) {
      return rows;
    }
  }

  Product _mapRow(Map<String, dynamic> row, Map<String, double> stockMap) {
    final categories = row['product_categories'];
    String category = 'Other';
    if (categories is Map) {
      category = categories['name'] as String? ?? 'Other';
    } else if (categories is List && categories.isNotEmpty) {
      final first = categories.first;
      if (first is Map) category = first['name'] as String? ?? 'Other';
    }

    final units = row['units'];
    String unit = 'Piece';
    if (units is Map) unit = units['name'] as String? ?? 'Piece';

    final id = row['id'] as String;
    final hasVariations = row['has_variations'] == true;

    return Product(
      id: id,
      sku: row['sku'] as String? ?? '—',
      name: row['name'] as String? ?? '—',
      category: category,
      costPrice: _num(row['cost_price']),
      retailPrice: _num(row['retail_price']),
      stock: hasVariations ? 0 : (stockMap[id] ?? 0),
      unit: unit,
      barcode: row['barcode'] as String?,
      minStock: _num(row['min_stock']),
      wholesalePrice: _numOrNull(row['wholesale_price']),
      hasVariations: hasVariations,
      description: row['description'] as String?,
      status: row['is_active'] == false
          ? ProductStatus.inactive
          : ProductStatus.active,
    );
  }

  double _num(dynamic v) =>
      v == null ? 0 : (num.tryParse(v.toString()) ?? 0).toDouble();

  double? _numOrNull(dynamic v) {
    if (v == null) return null;
    return (num.tryParse(v.toString()) ?? 0).toDouble();
  }
}
