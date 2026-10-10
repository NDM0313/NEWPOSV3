import '../../core/supabase/supabase_bootstrap.dart';
import '../../core/utils/branch_id.dart';
import '../../core/utils/local_date.dart';

class DraftPurchaseLineInput {
  const DraftPurchaseLineInput({
    required this.productId,
    required this.productName,
    required this.sku,
    required this.quantity,
    required this.unitPrice,
    required this.total,
  });

  final String productId;
  final String productName;
  final String sku;
  final double quantity;
  final double unitPrice;
  final double total;
}

class PurchasesWriteRepository {
  final _client = SupabaseBootstrap.client;

  Future<({String? purchaseId, String? documentNo, String? error})> createDraftPurchase({
    required String companyId,
    required String branchId,
    required String createdBy,
    required String supplierName,
    required List<DraftPurchaseLineInput> items,
  }) async {
    if (items.isEmpty) {
      return (purchaseId: null, documentNo: null, error: 'Add at least one line item.');
    }

    final effectiveBranch = safeRpcBranchId(branchId);
    if (effectiveBranch == null) {
      return (
        purchaseId: null,
        documentNo: null,
        error: 'Select a valid branch before creating a purchase.',
      );
    }

    final subtotal = items.fold<double>(0, (sum, i) => sum + i.total);
    final total = subtotal;
    final today = localTodayIso();
    final supplier = supplierName.trim().isEmpty ? 'Unknown' : supplierName.trim();

    try {
      final hdrRaw = await _client.rpc(
        'create_purchase_document_header',
        params: {
          'p_company_id': companyId,
          'p_branch_id': effectiveBranch,
          'p_purchase': {
            'po_date': today,
            'supplier_id': null,
            'supplier_name': supplier,
            'contact_number': null,
            'status': 'draft',
            'payment_status': 'unpaid',
            'subtotal': subtotal,
            'discount_amount': 0,
            'tax_amount': 0,
            'shipping_cost': 0,
            'total': total,
            'paid_amount': 0,
            'due_amount': total,
            'notes': null,
            'attachments': null,
          },
          'p_created_by': createdBy,
        },
      );

      if (hdrRaw is! Map) {
        return (
          purchaseId: null,
          documentNo: null,
          error: 'Invalid purchase header response.',
        );
      }

      final hdr = Map<String, dynamic>.from(hdrRaw);
      if (hdr['success'] != true || hdr['purchase_id'] == null) {
        return (
          purchaseId: null,
          documentNo: null,
          error: hdr['error']?.toString() ?? 'Failed to create draft purchase.',
        );
      }

      final purchaseId = hdr['purchase_id'].toString();
      final docNo = hdr['allocated_no']?.toString() ??
          hdr['draft_no']?.toString() ??
          hdr['po_no']?.toString();

      final rows = items
          .map(
            (item) => {
              'purchase_id': purchaseId,
              'product_id': item.productId,
              'product_name': item.productName,
              'sku': item.sku,
              'quantity': item.quantity,
              'unit_price': item.unitPrice,
              'total': item.total,
            },
          )
          .toList();

      try {
        await _client.from('purchase_items').insert(rows);
      } catch (e) {
        await _client.from('purchases').delete().eq('id', purchaseId);
        return (purchaseId: null, documentNo: null, error: 'Failed to save items: $e');
      }

      return (purchaseId: purchaseId, documentNo: docNo, error: null);
    } catch (e) {
      return (purchaseId: null, documentNo: null, error: e.toString());
    }
  }

  Future<({bool success, String? error})> finalizePurchase({
    required String companyId,
    required String purchaseId,
  }) async {
    try {
      final prior = await _client
          .from('purchases')
          .select('status')
          .eq('company_id', companyId)
          .eq('id', purchaseId)
          .maybeSingle();

      if (prior == null) {
        return (success: false, error: 'Purchase not found.');
      }

      final prev = (prior['status'] as String? ?? '').toLowerCase();
      if (prev == 'final' || prev == 'received') {
        return (success: false, error: 'Purchase is already finalized.');
      }
      if (prev == 'cancelled') {
        return (success: false, error: 'Cancelled purchase cannot be finalized.');
      }

      await _client
          .from('purchases')
          .update({'status': 'final'})
          .eq('id', purchaseId)
          .eq('company_id', companyId);

      try {
        final raw = await _client.rpc(
          'record_purchase_with_accounting',
          params: {'p_purchase_id': purchaseId},
        );
        if (raw is Map && raw['success'] == false) {
          return (
            success: false,
            error: raw['error']?.toString() ?? 'Purchase accounting failed.',
          );
        }
      } catch (e) {
        return (success: false, error: 'Purchase accounting failed: $e');
      }

      return (success: true, error: null);
    } catch (e) {
      return (success: false, error: e.toString());
    }
  }

  /// Supplier payment against a finalized purchase (erp-mobile-app `recordSupplierPayment`).
  Future<({bool success, String? error})> recordSupplierPayment({
    required String companyId,
    required String branchId,
    required String purchaseId,
    required double amount,
    required String createdBy,
  }) async {
    if (amount <= 0) {
      return (success: false, error: 'Amount must be greater than zero.');
    }

    final branch = safeRpcBranchId(branchId);
    if (branch == null) {
      return (success: false, error: 'Invalid branch for payment.');
    }

    try {
      final accountRow = await _client
          .from('accounts')
          .select('id')
          .eq('company_id', companyId)
          .inFilter('type', ['cash', 'bank'])
          .limit(1)
          .maybeSingle();

      final accountId = accountRow?['id']?.toString();
      if (accountId == null) {
        return (success: false, error: 'No cash/bank account found for payments.');
      }

      final raw = await _client.rpc(
        'record_payment_with_accounting',
        params: {
          'p_company_id': companyId,
          'p_branch_id': branch,
          'p_payment_type': 'paid',
          'p_reference_type': 'purchase',
          'p_reference_id': purchaseId,
          'p_amount': amount,
          'p_payment_method': 'cash',
          'p_payment_date': localTodayIso(),
          'p_payment_account_id': accountId,
          'p_reference_number': null,
          'p_notes': 'Flutter ERP supplier payment',
          'p_created_by': createdBy,
          'p_worker_stage_id': null,
        },
      );

      if (raw is Map) {
        final res = Map<String, dynamic>.from(raw);
        if (res['success'] == true && res['payment_id'] != null) {
          return (success: true, error: null);
        }
        return (success: false, error: res['error']?.toString() ?? 'Payment failed.');
      }
      return (success: true, error: null);
    } catch (e) {
      return (success: false, error: e.toString());
    }
  }

  Future<({bool success, String? error})> cancelPurchase({
    required String purchaseId,
    String? userId,
    String? reason,
  }) async {
    try {
      final raw = await _client.rpc(
        'cancel_purchase_full_void',
        params: {
          'p_purchase_id': purchaseId,
          'p_user_id': userId,
          'p_reason': reason,
        },
      );
      if (raw is Map && raw['success'] == false) {
        return (success: false, error: raw['error']?.toString() ?? 'Cancel failed.');
      }
      return (success: true, error: null);
    } catch (e) {
      return (success: false, error: e.toString());
    }
  }
}
