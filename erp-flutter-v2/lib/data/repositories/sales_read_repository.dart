import '../../core/supabase/supabase_bootstrap.dart';
import '../../core/utils/branch_id.dart';
import '../../core/utils/sale_document_no.dart';
import '../models/sale.dart';

const _salesListSelect =
    'id, invoice_no, order_no, draft_no, customer_id, customer_name, total, paid_amount, due_amount, status, payment_status, invoice_date, created_at, branch_id, is_studio, created_by, branches(name)';

const _saleDetailSelect =
    'id, invoice_no, order_no, draft_no, customer_id, customer_name, total, paid_amount, due_amount, subtotal, discount_amount, tax_amount, status, payment_status, invoice_date, notes, branch_id, is_studio, created_by, branches(name)';

class SalesReadRepository {
  final _client = SupabaseBootstrap.client;

  Future<({List<SaleListItem> sales, String? error})> getSales({
    required String companyId,
    String? branchId,
    List<String>? accessibleBranchIds,
    bool isolateToWorker = false,
    String? authUserId,
    String? profileId,
  }) async {
    try {
      var query = _client
          .from('sales')
          .select(_salesListSelect)
          .eq('company_id', companyId);

      query = _applyBranchFilter(query, branchId, accessibleBranchIds);

      if (isolateToWorker && authUserId != null) {
        final ids = <String>[authUserId];
        if (profileId != null &&
            profileId.isNotEmpty &&
            profileId != authUserId) {
          ids.add(profileId);
        }
        if (ids.length == 1) {
          query = query.eq('created_by', ids.first);
        } else {
          query = query.or(
            'created_by.eq.${ids[0]},created_by.eq.${ids[1]}',
          );
        }
      }

      final data = await query
          .order('invoice_date', ascending: false)
          .order('created_at', ascending: false)
          .limit(100);

      final sales = (data as List).map((row) {
        final map = Map<String, dynamic>.from(row as Map);
        return _mapListItem(map);
      }).toList();

      return (sales: sales, error: null);
    } catch (e) {
      return (sales: <SaleListItem>[], error: e.toString());
    }
  }

  Future<({SaleDetail? sale, String? error})> getSaleById({
    required String companyId,
    required String saleId,
  }) async {
    try {
      final row = await _client
          .from('sales')
          .select(_saleDetailSelect)
          .eq('company_id', companyId)
          .eq('id', saleId)
          .maybeSingle();

      if (row == null) {
        return (
          sale: null,
          error: 'Sale not found or access denied.',
        );
      }

      final map = Map<String, dynamic>.from(row);
      final items = await _fetchSaleItems(saleId);
      final payments = await _fetchPaymentSummary(companyId, saleId);

      return (
        sale: _mapDetail(map, items, payments),
        error: null,
      );
    } catch (e) {
      return (sale: null, error: e.toString());
    }
  }

  dynamic _applyBranchFilter(
    dynamic query,
    String? branchId,
    List<String>? accessibleBranchIds,
  ) {
    final branch = safeRpcBranchId(branchId);
    if (branch != null) {
      return query.eq('branch_id', branch);
    }
    if (accessibleBranchIds != null && accessibleBranchIds.isNotEmpty) {
      return query.inFilter('branch_id', accessibleBranchIds);
    }
    return query;
  }

  Future<List<SaleLineItem>> _fetchSaleItems(String saleId) async {
    final items = await _fetchItemsFromTable('sale_items', saleId);
    if (items.isNotEmpty) return items;
    return _fetchItemsFromTable('sales_items', saleId);
  }

  Future<List<SaleLineItem>> _fetchItemsFromTable(
    String table,
    String saleId,
  ) async {
    try {
      final data = await _client
          .from(table)
          .select('id, product_id, product_name, sku, quantity, unit_price, total')
          .eq('sale_id', saleId);

      return (data as List).map((row) {
        final map = Map<String, dynamic>.from(row as Map);
        return SaleLineItem(
          id: map['id']?.toString() ?? '',
          productId: map['product_id']?.toString() ?? '',
          productName: map['product_name'] as String? ?? '—',
          sku: map['sku'] as String? ?? '—',
          quantity: _num(map['quantity']),
          unitPrice: _num(map['unit_price']),
          total: _num(map['total']),
        );
      }).toList();
    } catch (_) {
      return [];
    }
  }

  Future<List<SalePaymentSummary>> _fetchPaymentSummary(
    String companyId,
    String saleId,
  ) async {
    try {
      final data = await _client
          .from('payments')
          .select('id, amount, payment_date, payment_method')
          .eq('company_id', companyId)
          .eq('reference_type', 'sale')
          .eq('reference_id', saleId)
          .isFilter('voided_at', null)
          .order('payment_date', ascending: false);

      return (data as List).map((row) {
        final map = Map<String, dynamic>.from(row as Map);
        final date = map['payment_date']?.toString() ?? '';
        return SalePaymentSummary(
          id: map['id']?.toString() ?? '',
          amount: _num(map['amount']),
          paymentDate: date.length >= 10 ? date.substring(0, 10) : date,
          method: map['payment_method'] as String? ?? '—',
        );
      }).toList();
    } catch (_) {
      return [];
    }
  }

  SaleListItem _mapListItem(Map<String, dynamic> map) {
    final branch = map['branches'];
    String? branchName;
    if (branch is Map) {
      branchName = branch['name'] as String?;
    }

    final dateRaw = map['invoice_date']?.toString() ?? '';
    return SaleListItem(
      id: map['id'] as String,
      documentNo: readSaleDocumentNo(map),
      customerName: map['customer_name'] as String? ?? 'Walk-in',
      total: _num(map['total']),
      paid: _num(map['paid_amount']),
      due: _num(map['due_amount']),
      status: map['status'] as String? ?? '—',
      paymentStatus: map['payment_status'] as String? ?? '—',
      date: dateRaw.length >= 10 ? dateRaw.substring(0, 10) : dateRaw,
      branchName: branchName,
      isStudio: map['is_studio'] == true,
    );
  }

  SaleDetail _mapDetail(
    Map<String, dynamic> map,
    List<SaleLineItem> items,
    List<SalePaymentSummary> payments,
  ) {
    final branch = map['branches'];
    String branchName = '—';
    if (branch is Map) {
      branchName = branch['name'] as String? ?? '—';
    }

    final dateRaw = map['invoice_date']?.toString() ?? '';
    return SaleDetail(
      id: map['id'] as String,
      documentNo: readSaleDocumentNo(map),
      status: map['status'] as String? ?? '—',
      paymentStatus: map['payment_status'] as String? ?? '—',
      customerName: map['customer_name'] as String? ?? 'Walk-in',
      date: dateRaw.length >= 10 ? dateRaw.substring(0, 10) : dateRaw,
      branchName: branchName,
      total: _num(map['total']),
      paid: _num(map['paid_amount']),
      due: _num(map['due_amount']),
      subtotal: _num(map['subtotal']),
      discount: _num(map['discount_amount']),
      tax: _num(map['tax_amount']),
      items: items,
      payments: payments,
      notes: map['notes'] as String?,
      isStudio: map['is_studio'] == true,
    );
  }

  double _num(dynamic v) =>
      v == null ? 0 : (num.tryParse(v.toString()) ?? 0).toDouble();
}
