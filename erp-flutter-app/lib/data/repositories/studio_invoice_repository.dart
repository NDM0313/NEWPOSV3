import '../../core/supabase/supabase_bootstrap.dart';

class UpsertStudioInvoiceLineResult {
  const UpsertStudioInvoiceLineResult({
    required this.productId,
    required this.productName,
    required this.invoiceItemId,
  });

  final String productId;
  final String productName;
  final String invoiceItemId;
}

class _StudioProductRef {
  const _StudioProductRef({required this.id, required this.name, required this.sku});
  final String id;
  final String name;
  final String sku;
}

/// Mobile parity: `erp-mobile-app/src/api/studioInvoiceLine.ts`
class StudioInvoiceRepository {
  final _client = SupabaseBootstrap.client;

  Future<({UpsertStudioInvoiceLineResult? data, String? error})> upsertStudioInvoiceLine({
    required String companyId,
    required String saleId,
    required String productionId,
    required String invoiceNoLabel,
    required double salePrice,
    required String productName,
    String? existingProductId,
  }) async {
    if (salePrice <= 0) {
      return (data: null, error: 'Enter a valid sale price.');
    }

    try {
      final product = await _resolveProduct(
        companyId: companyId,
        salePrice: salePrice,
        productName: productName,
        invoiceNoLabel: invoiceNoLabel,
        existingProductId: existingProductId,
      );
      if (product.error != null) {
        return (data: null, error: product.error);
      }
      final p = product.product!;

      final itemPayload = {
        'product_id': p.id,
        'product_name': p.name,
        'sku': p.sku,
        'unit_price': salePrice,
        'total': salePrice,
        'is_studio_product': true,
      };

      String? itemId = await _existingInvoiceItemId(productionId, saleId);

      if (itemId != null) {
        final oldItem = await _client
            .from('sales_items')
            .select('total')
            .eq('id', itemId)
            .maybeSingle();
        final oldTotal = (oldItem?['total'] as num?)?.toDouble() ?? 0;

        await _client.from('sales_items').update(itemPayload).eq('id', itemId);
        await _recalcSaleTotals(saleId, oldTotal: oldTotal, newLineTotal: salePrice);
      } else {
        final inserted = await _client
            .from('sales_items')
            .insert({
              'sale_id': saleId,
              'quantity': 1,
              ...itemPayload,
            })
            .select('id')
            .maybeSingle();
        itemId = inserted?['id']?.toString();
        if (itemId == null) {
          return (data: null, error: 'Failed to add invoice line.');
        }
        await _recalcSaleTotals(saleId, addTotal: salePrice);
      }

      await _client.from('studio_productions').update({
        'generated_product_id': p.id,
        'generated_invoice_item_id': itemId,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', productionId);

      if (productName.trim().isNotEmpty) {
        await _client.from('studio_productions').update({
          'design_name': productName.trim(),
        }).eq('id', productionId);
      }

      return (
        data: UpsertStudioInvoiceLineResult(
          productId: p.id,
          productName: p.name,
          invoiceItemId: itemId,
        ),
        error: null,
      );
    } catch (e) {
      return (data: null, error: e.toString());
    }
  }

  Future<({_StudioProductRef? product, String? error})> _resolveProduct({
    required String companyId,
    required double salePrice,
    required String productName,
    required String invoiceNoLabel,
    String? existingProductId,
  }) async {
    if (existingProductId != null && existingProductId.isNotEmpty) {
      final row = await _client
          .from('products')
          .select('id, name, sku')
          .eq('company_id', companyId)
          .eq('id', existingProductId)
          .maybeSingle();
      if (row == null) return (product: null, error: 'Product not found.');
      return (
        product: _StudioProductRef(
          id: row['id'].toString(),
          name: row['name']?.toString() ?? 'Product',
          sku: row['sku']?.toString() ?? '',
        ),
        error: null,
      );
    }

    final name = productName.trim().isNotEmpty
        ? productName.trim()
        : 'Studio – $invoiceNoLabel';

    final exactRows = await _client
        .from('products')
        .select('id, name, sku')
        .eq('company_id', companyId)
        .ilike('name', name)
        .limit(5);

    for (final row in exactRows as List) {
      final m = Map<String, dynamic>.from(row as Map);
      if ((m['name']?.toString().trim().toLowerCase() ?? '') == name.toLowerCase()) {
        return (
          product: _StudioProductRef(
            id: m['id'].toString(),
            name: m['name']?.toString() ?? name,
            sku: m['sku']?.toString() ?? '',
          ),
          error: null,
        );
      }
    }

    if ((exactRows as List).length == 1) {
      final m = Map<String, dynamic>.from(exactRows[0] as Map);
      return (
        product: _StudioProductRef(
          id: m['id'].toString(),
          name: m['name']?.toString() ?? name,
          sku: m['sku']?.toString() ?? '',
        ),
        error: null,
      );
    }

    for (var attempt = 0; attempt < 3; attempt++) {
      final sku = 'STD-PROD-${DateTime.now().millisecondsSinceEpoch}-$attempt';
      try {
        final row = await _client
            .from('products')
            .insert({
              'company_id': companyId,
              'name': name,
              'sku': sku,
              'cost_price': 0,
              'retail_price': salePrice,
              'wholesale_price': salePrice,
              'min_stock': 0,
              'max_stock': 99999,
              'has_variations': false,
              'is_rentable': false,
              'is_sellable': true,
              'track_stock': true,
              'is_active': true,
            })
            .select('id, name, sku')
            .maybeSingle();
        if (row != null) {
          return (
            product: _StudioProductRef(
              id: row['id'].toString(),
              name: row['name']?.toString() ?? name,
              sku: row['sku']?.toString() ?? sku,
            ),
            error: null,
          );
        }
      } catch (e) {
        final msg = e.toString();
        if (!msg.contains('23505') && !msg.toLowerCase().contains('duplicate')) {
          return (product: null, error: msg);
        }
      }
    }
    return (product: null, error: 'Could not create studio product — SKU conflict.');
  }

  Future<String?> _existingInvoiceItemId(String productionId, String saleId) async {
    final prod = await _client
        .from('studio_productions')
        .select('generated_invoice_item_id')
        .eq('id', productionId)
        .maybeSingle();
    final linked = prod?['generated_invoice_item_id']?.toString();
    if (linked != null && linked.isNotEmpty) return linked;

    final items = await _client
        .from('sales_items')
        .select('id')
        .eq('sale_id', saleId)
        .eq('is_studio_product', true)
        .limit(1);
    if ((items as List).isEmpty) return null;
    return (items[0] as Map)['id']?.toString();
  }

  Future<void> _recalcSaleTotals(
    String saleId, {
    double oldTotal = 0,
    double newLineTotal = 0,
    double addTotal = 0,
  }) async {
    final sale = await _client
        .from('sales')
        .select('total, paid_amount')
        .eq('id', saleId)
        .maybeSingle();
    if (sale == null) return;

    final current = (sale['total'] as num?)?.toDouble() ?? 0;
    final paid = (sale['paid_amount'] as num?)?.toDouble() ?? 0;
    final newTotal = addTotal > 0
        ? current + addTotal
        : (current - oldTotal + newLineTotal).clamp(0, double.infinity);
    final due = (newTotal - paid).clamp(0, double.infinity);

    await _client.from('sales').update({
      'total': newTotal,
      'due_amount': due,
      'updated_at': DateTime.now().toIso8601String(),
    }).eq('id', saleId);
  }
}
