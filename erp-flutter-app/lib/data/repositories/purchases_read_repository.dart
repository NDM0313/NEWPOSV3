import '../../core/supabase/supabase_bootstrap.dart';
import '../../core/utils/branch_id.dart';
import '../../core/utils/sale_document_no.dart';
import '../models/purchase.dart';

const _purchaseListSelect =
    'id, po_no, order_no, draft_no, supplier_name, total, paid_amount, due_amount, status, payment_status, po_date, created_at, branch_id, created_by';

const _purchaseDetailSelect =
    'id, po_no, order_no, draft_no, supplier_id, supplier_name, contact_number, branch_id, subtotal, discount_amount, tax_amount, shipping_cost, total, paid_amount, due_amount, status, payment_status, po_date, notes, branches(name)';

class PurchasesReadRepository {
  final _client = SupabaseBootstrap.client;

  Future<({List<PurchaseListItem> purchases, String? error})> getPurchases({
    required String companyId,
    String? branchId,
    List<String>? accessibleBranchIds,
    bool isolateToWorker = false,
    String? authUserId,
    String? profileId,
  }) async {
    try {
      var query = _client
          .from('purchases')
          .select(_purchaseListSelect)
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
          .order('po_date', ascending: false)
          .order('created_at', ascending: false)
          .limit(100);

      final rows = (data as List).map((r) => Map<String, dynamic>.from(r as Map)).toList();
      final ids = rows.map((r) => r['id'] as String).toList();
      final itemCounts = await _fetchItemCounts(ids);

      final purchases = rows.map((map) {
        final dateRaw = map['po_date']?.toString() ?? '';
        return PurchaseListItem(
          id: map['id'] as String,
          documentNo: readPurchaseDocumentNo(map),
          supplierName: map['supplier_name'] as String? ?? '—',
          total: _num(map['total']),
          paid: _num(map['paid_amount']),
          due: _num(map['due_amount']),
          status: map['status'] as String? ?? '—',
          paymentStatus: map['payment_status'] as String? ?? '—',
          date: dateRaw.length >= 10 ? dateRaw.substring(0, 10) : dateRaw,
          itemCount: itemCounts[map['id'] as String] ?? 0,
        );
      }).toList();

      return (purchases: purchases, error: null);
    } catch (e) {
      return (purchases: <PurchaseListItem>[], error: e.toString());
    }
  }

  Future<({PurchaseDetail? purchase, String? error})> getPurchaseById({
    required String companyId,
    required String purchaseId,
  }) async {
    try {
      final row = await _client
          .from('purchases')
          .select(_purchaseDetailSelect)
          .eq('company_id', companyId)
          .eq('id', purchaseId)
          .maybeSingle();

      if (row == null) {
        return (
          purchase: null,
          error: 'Purchase not found or access denied.',
        );
      }

      final map = Map<String, dynamic>.from(row);
      final items = await _fetchPurchaseItems(purchaseId);

      return (purchase: _mapDetail(map, items), error: null);
    } catch (e) {
      return (purchase: null, error: e.toString());
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

  Future<Map<String, int>> _fetchItemCounts(List<String> purchaseIds) async {
    if (purchaseIds.isEmpty) return {};
    try {
      final data = await _client
          .from('purchase_items')
          .select('purchase_id')
          .inFilter('purchase_id', purchaseIds);

      final counts = <String, int>{};
      for (final row in data as List) {
        if (row is! Map) continue;
        final pid = row['purchase_id']?.toString();
        if (pid == null) continue;
        counts[pid] = (counts[pid] ?? 0) + 1;
      }
      return counts;
    } catch (_) {
      return {};
    }
  }

  Future<List<PurchaseLineItem>> _fetchPurchaseItems(String purchaseId) async {
    try {
      final data = await _client
          .from('purchase_items')
          .select('id, product_name, sku, quantity, unit_price, total')
          .eq('purchase_id', purchaseId);

      return (data as List).map((row) {
        final map = Map<String, dynamic>.from(row as Map);
        return PurchaseLineItem(
          id: map['id']?.toString() ?? '',
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

  PurchaseDetail _mapDetail(
    Map<String, dynamic> map,
    List<PurchaseLineItem> items,
  ) {
    final branch = map['branches'];
    String branchName = '—';
    if (branch is Map) {
      branchName = branch['name'] as String? ?? '—';
    }

    final dateRaw = map['po_date']?.toString() ?? '';
    return PurchaseDetail(
      id: map['id'] as String,
      documentNo: readPurchaseDocumentNo(map),
      status: map['status'] as String? ?? '—',
      paymentStatus: map['payment_status'] as String? ?? '—',
      supplierName: map['supplier_name'] as String? ?? '—',
      date: dateRaw.length >= 10 ? dateRaw.substring(0, 10) : dateRaw,
      branchName: branchName,
      total: _num(map['total']),
      paid: _num(map['paid_amount']),
      due: _num(map['due_amount']),
      subtotal: _num(map['subtotal']),
      discount: _num(map['discount_amount']),
      tax: _num(map['tax_amount']),
      shipping: _num(map['shipping_cost']),
      items: items,
      notes: map['notes'] as String?,
    );
  }

  double _num(dynamic v) =>
      v == null ? 0 : (num.tryParse(v.toString()) ?? 0).toDouble();
}
