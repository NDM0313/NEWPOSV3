import '../../core/supabase/supabase_bootstrap.dart';
import '../../core/utils/branch_id.dart';
import '../../core/utils/local_date.dart';

class DraftSaleLineInput {
  const DraftSaleLineInput({
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

/// Phase 3: draft create + finalize (stock + GL via server RPCs).
class SalesWriteRepository {
  final _client = SupabaseBootstrap.client;

  Future<({String? saleId, String? documentNo, String? error})> createDraftSale({
    required String companyId,
    required String branchId,
    required String createdBy,
    required String customerName,
    String? customerId,
    required List<DraftSaleLineInput> items,
  }) async {
    if (items.isEmpty) {
      return (saleId: null, documentNo: null, error: 'Add at least one line item.');
    }

    final effectiveBranch = safeRpcBranchId(branchId);
    if (effectiveBranch == null) {
      return (
        saleId: null,
        documentNo: null,
        error: 'Select a valid branch before creating a sale.',
      );
    }

    final subtotal = items.fold<double>(0, (sum, i) => sum + i.total);
    final total = subtotal;
    final today = localTodayIso();
    final name = customerName.trim().isEmpty ? 'Walk-in' : customerName.trim();

    try {
      final hdrRaw = await _client.rpc(
        'create_sale_document_header',
        params: {
          'p_company_id': companyId,
          'p_branch_id': effectiveBranch,
          'p_is_studio': false,
          'p_sale': {
            'invoice_date': today,
            'customer_id': customerId,
            'customer_name': name,
            'subtotal': subtotal,
            'discount_amount': 0,
            'tax_amount': 0,
            'expenses': 0,
            'total': total,
            'type': 'invoice',
            'status': 'draft',
            'payment_status': 'unpaid',
            'payment_method': 'Cash',
            'paid_amount': 0,
            'due_amount': total,
          },
          'p_created_by': createdBy,
        },
      );

      if (hdrRaw is! Map) {
        return (
          saleId: null,
          documentNo: null,
          error: 'Invalid response from create_sale_document_header.',
        );
      }

      final hdr = Map<String, dynamic>.from(hdrRaw);
      if (hdr['success'] != true || hdr['sale_id'] == null) {
        return (
          saleId: null,
          documentNo: null,
          error: hdr['error']?.toString() ?? 'Failed to create draft sale.',
        );
      }

      final saleId = hdr['sale_id'].toString();
      final docNo = hdr['document_no']?.toString();

      final itemsPayload = items
          .map(
            (item) => {
              'sale_id': saleId,
              'product_id': item.productId,
              'product_name': item.productName,
              'sku': item.sku,
              'quantity': item.quantity,
              'unit_price': item.unitPrice,
              'discount_amount': 0,
              'tax_amount': 0,
              'total': item.total,
            },
          )
          .toList();

      final itemsErr = await _insertSaleItems(itemsPayload);
      if (itemsErr != null) {
        await _client.from('sales').delete().eq('id', saleId);
        return (saleId: null, documentNo: null, error: itemsErr);
      }

      return (saleId: saleId, documentNo: docNo, error: null);
    } catch (e) {
      return (saleId: null, documentNo: null, error: e.toString());
    }
  }

  /// Update draft/editable sale lines via server RPC.
  Future<({bool success, String? error})> updateSaleWithItems({
    required String saleId,
    required String userId,
    required String customerName,
    required List<DraftSaleLineInput> items,
  }) async {
    if (items.isEmpty) {
      return (success: false, error: 'Add at least one line item.');
    }

    final pItems = items
        .map(
          (i) => {
            'product_id': i.productId,
            'variation_id': null,
            'product_name': i.productName,
            'sku': i.sku,
            'quantity': i.quantity,
            'unit_price': i.unitPrice,
            'discount_amount': 0,
            'tax_amount': 0,
            'total': i.total,
          },
        )
        .toList();

    try {
      final raw = await _client.rpc(
        'update_sale_with_items',
        params: {
          'p_sale_id': saleId,
          'p_user_id': userId,
          'p_items': pItems,
          'p_discount_amount': 0,
          'p_tax_amount': 0,
          'p_shipment_charges': 0,
          'p_extra_expenses': 0,
          'p_notes': null,
          'p_customer_name': customerName.trim().isEmpty ? 'Walk-in' : customerName.trim(),
          'p_contact_number': null,
          'p_payment_method': null,
          'p_invoice_date': null,
          'p_deadline': null,
          'p_customer_id': null,
        },
      );

      if (raw is Map && raw['success'] == false) {
        return (success: false, error: raw['error']?.toString() ?? 'Update failed.');
      }
      return (success: true, error: null);
    } catch (e) {
      return (success: false, error: e.toString());
    }
  }

  /// Finalize sale — mirrors erp-mobile-app `updateSaleStatus(..., 'final')`.
  Future<({bool success, String? invoiceNo, String? error})> finalizeSale(
    String saleId,
  ) async {
    try {
      final priorRow = await _client
          .from('sales')
          .select('status')
          .eq('id', saleId)
          .maybeSingle();

      if (priorRow == null) {
        return (success: false, invoiceNo: null, error: 'Sale not found.');
      }

      final prev = (priorRow['status'] as String? ?? '').toLowerCase();
      if (prev == 'final') {
        return (success: false, invoiceNo: null, error: 'Sale is already finalized.');
      }
      if (prev == 'cancelled') {
        return (success: false, invoiceNo: null, error: 'Cancelled sale cannot be finalized.');
      }

      final updated = await _client
          .from('sales')
          .update({'status': 'final'})
          .eq('id', saleId)
          .select('id, status, invoice_no, order_no')
          .maybeSingle();

      if (updated == null) {
        return (success: false, invoiceNo: null, error: 'Failed to update sale status.');
      }

      final wasPosted = prev == 'final';
      if (!wasPosted) {
        final stockErr = await _ensureSaleStockPosted(saleId);
        if (stockErr != null) {
          await _client.from('sales').update({'status': prev}).eq('id', saleId);
          return (success: false, invoiceNo: null, error: stockErr);
        }

        try {
          await _client.rpc(
            'record_sale_with_accounting',
            params: {'p_sale_id': saleId},
          );
        } catch (e) {
          return (
            success: false,
            invoiceNo: null,
            error: 'Sale accounting failed: $e',
          );
        }
      }

      final map = Map<String, dynamic>.from(updated);
      final invoice = map['invoice_no']?.toString();
      return (success: true, invoiceNo: invoice, error: null);
    } catch (e) {
      return (success: false, invoiceNo: null, error: e.toString());
    }
  }

  /// POS checkout — final sale + stock + GL + cash payment (erp-mobile-app `isPOS` path).
  Future<({String? saleId, String? invoiceNo, String? error})> createPosSale({
    required String companyId,
    required String branchId,
    required String createdBy,
    required String customerName,
    required List<DraftSaleLineInput> items,
  }) async {
    if (items.isEmpty) {
      return (saleId: null, invoiceNo: null, error: 'Add at least one line item.');
    }

    final effectiveBranch = safeRpcBranchId(branchId);
    if (effectiveBranch == null) {
      return (
        saleId: null,
        invoiceNo: null,
        error: 'Select a valid branch before POS checkout.',
      );
    }

    final subtotal = items.fold<double>(0, (sum, i) => sum + i.total);
    final total = subtotal;
    final today = localTodayIso();
    final name = customerName.trim().isEmpty ? 'Walk-in' : customerName.trim();
    final paymentToRecord = total;
    final headerPaid = paymentToRecord > 0 ? 0 : total;
    final headerDue = paymentToRecord > 0 ? total : 0;

    try {
      String? saleId;
      String? docNo;

      for (var attempt = 0; attempt < 12; attempt++) {
        final numRaw = await _client.rpc(
          'generate_document_number',
          params: {
            'p_company_id': companyId,
            'p_branch_id': effectiveBranch,
            'p_document_type': 'pos',
            'p_include_year': false,
          },
        );
        docNo = numRaw?.toString();
        if (docNo == null || docNo.isEmpty) {
          docNo = 'PS-${DateTime.now().millisecondsSinceEpoch % 10000}';
        }

        try {
          final inserted = await _client
              .from('sales')
              .insert({
                'company_id': companyId,
                'branch_id': effectiveBranch,
                'invoice_no': docNo,
                'invoice_date': today,
                'customer_name': name,
                'type': 'invoice',
                'status': 'final',
                'payment_status': paymentToRecord > 0 ? 'unpaid' : 'paid',
                'payment_method': 'Cash',
                'subtotal': subtotal,
                'discount_amount': 0,
                'tax_amount': 0,
                'expenses': 0,
                'total': total,
                'paid_amount': headerPaid,
                'due_amount': headerDue,
                'created_by': createdBy,
              })
              .select('id')
              .maybeSingle();

          if (inserted != null && inserted['id'] != null) {
            saleId = inserted['id'].toString();
            break;
          }
        } catch (e) {
          final msg = e.toString();
          final dup = msg.contains('23505') ||
              msg.contains('duplicate key') ||
              msg.contains('idx_sales_company_invoice_no');
          if (!dup) {
            return (saleId: null, invoiceNo: null, error: 'Failed to create POS sale: $e');
          }
        }
      }

      if (saleId == null) {
        return (
          saleId: null,
          invoiceNo: null,
          error: 'Failed to allocate POS invoice number after retries.',
        );
      }

      final itemsPayload = items
          .map(
            (item) => {
              'sale_id': saleId,
              'product_id': item.productId,
              'product_name': item.productName,
              'sku': item.sku,
              'quantity': item.quantity,
              'unit_price': item.unitPrice,
              'discount_amount': 0,
              'tax_amount': 0,
              'total': item.total,
            },
          )
          .toList();

      final itemsErr = await _insertSaleItems(itemsPayload);
      if (itemsErr != null) {
        await _client.from('sales').delete().eq('id', saleId);
        return (saleId: null, invoiceNo: null, error: itemsErr);
      }

      final stockErr = await _ensureSaleStockPosted(saleId);
      if (stockErr != null) {
        await _client.from('sales').delete().eq('id', saleId);
        return (saleId: null, invoiceNo: null, error: stockErr);
      }

      try {
        final postRaw = await _client.rpc(
          'record_sale_with_accounting',
          params: {'p_sale_id': saleId},
        );
        if (postRaw is Map && postRaw['success'] == false) {
          return (
            saleId: null,
            invoiceNo: null,
            error: postRaw['error']?.toString() ?? 'Sale accounting failed.',
          );
        }
      } catch (e) {
        return (saleId: null, invoiceNo: null, error: 'Sale accounting failed: $e');
      }

      if (paymentToRecord > 0) {
        final pay = await recordSalePaymentReceived(
          companyId: companyId,
          branchId: branchId,
          saleId: saleId,
          amount: paymentToRecord,
          createdBy: createdBy,
        );
        if (!pay.success) {
          return (saleId: saleId, invoiceNo: docNo, error: pay.error ?? 'Payment failed.');
        }
      }

      return (saleId: saleId, invoiceNo: docNo, error: null);
    } catch (e) {
      return (saleId: null, invoiceNo: null, error: e.toString());
    }
  }

  /// Receive payment against a finalized sale (cash default account).
  Future<({bool success, String? error})> recordSalePaymentReceived({
    required String companyId,
    required String branchId,
    required String saleId,
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
          'p_payment_type': 'received',
          'p_reference_type': 'sale',
          'p_reference_id': saleId,
          'p_amount': amount,
          'p_payment_method': 'cash',
          'p_payment_date': localTodayIso(),
          'p_payment_account_id': accountId,
          'p_reference_number': null,
          'p_notes': 'Flutter ERP mobile payment',
          'p_created_by': createdBy,
          'p_worker_stage_id': null,
        },
      );

      if (raw is Map) {
        final res = Map<String, dynamic>.from(raw);
        if (res['success'] == true && res['payment_id'] != null) {
          return (success: true, error: null);
        }
        return (
          success: false,
          error: res['error']?.toString() ?? 'Payment failed.',
        );
      }
      return (success: true, error: null);
    } catch (e) {
      return (success: false, error: e.toString());
    }
  }

  Future<String?> _ensureSaleStockPosted(String saleId) async {
    try {
      final stockRaw = await _client.rpc(
        'ensure_sale_stock_movements',
        params: {'p_sale_id': saleId},
      );
      if (stockRaw is Map) {
        final res = Map<String, dynamic>.from(stockRaw);
        if (res['success'] == false) {
          return 'Inventory update failed: ${res['error'] ?? 'Unknown error'}';
        }
      }
      return null;
    } catch (e) {
      return 'Inventory update failed: $e';
    }
  }

  Future<String?> _insertSaleItems(List<Map<String, dynamic>> rows) async {
    try {
      await _client.from('sale_items').insert(rows);
      return null;
    } catch (e) {
      final msg = e.toString();
      if (msg.contains('sale_items') || msg.contains('42P01')) {
        try {
          await _client.from('sales_items').insert(rows);
          return null;
        } catch (e2) {
          return 'Failed to save line items: $e2';
        }
      }
      return 'Failed to save line items: $e';
    }
  }
}
