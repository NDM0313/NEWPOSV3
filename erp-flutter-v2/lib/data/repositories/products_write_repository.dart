import '../../core/supabase/supabase_bootstrap.dart';

class ProductsWriteRepository {
  final _client = SupabaseBootstrap.client;

  Future<({String? productId, String? error})> createProduct({
    required String companyId,
    required String name,
    required String sku,
    required double costPrice,
    required double retailPrice,
  }) async {
    final trimmedName = name.trim();
    final trimmedSku = sku.trim();
    if (trimmedName.isEmpty) {
      return (productId: null, error: 'Product name is required.');
    }
    if (trimmedSku.isEmpty) {
      return (productId: null, error: 'SKU is required.');
    }

    try {
      final row = await _client
          .from('products')
          .insert({
            'company_id': companyId,
            'name': trimmedName,
            'sku': trimmedSku,
            'cost_price': costPrice,
            'retail_price': retailPrice,
            'wholesale_price': retailPrice,
            'min_stock': 0,
            'max_stock': 99999,
            'has_variations': false,
            'is_rentable': false,
            'is_sellable': true,
            'track_stock': true,
            'is_active': true,
          })
          .select('id')
          .maybeSingle();

      if (row == null || row['id'] == null) {
        return (productId: null, error: 'Failed to create product.');
      }

      return (productId: row['id'].toString(), error: null);
    } catch (e) {
      final msg = e.toString();
      if (msg.contains('23505') || msg.contains('duplicate')) {
        return (productId: null, error: 'SKU already in use.');
      }
      return (productId: null, error: e.toString());
    }
  }

  Future<({bool success, String? error})> updateProduct({
    required String companyId,
    required String productId,
    required String name,
    required String sku,
    required double costPrice,
    required double retailPrice,
    bool active = true,
  }) async {
    final trimmedName = name.trim();
    final trimmedSku = sku.trim();
    if (trimmedName.isEmpty) {
      return (success: false, error: 'Product name is required.');
    }
    if (trimmedSku.isEmpty) {
      return (success: false, error: 'SKU is required.');
    }

    try {
      await _client
          .from('products')
          .update({
            'name': trimmedName,
            'sku': trimmedSku,
            'cost_price': costPrice,
            'retail_price': retailPrice,
            'wholesale_price': retailPrice,
            'is_active': active,
          })
          .eq('id', productId)
          .eq('company_id', companyId);

      return (success: true, error: null);
    } catch (e) {
      final msg = e.toString();
      if (msg.contains('23505') || msg.contains('duplicate')) {
        return (success: false, error: 'SKU already in use.');
      }
      return (success: false, error: e.toString());
    }
  }
}
