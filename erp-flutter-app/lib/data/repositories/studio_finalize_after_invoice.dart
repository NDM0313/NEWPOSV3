import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/supabase/supabase_bootstrap.dart';
import 'journal_write_repository.dart';

/// Port of `erp-mobile-app/src/api/studioFinalizeAfterInvoice.ts` + stock lifecycle.
class StudioFinalizeAfterInvoiceRepository {
  StudioFinalizeAfterInvoiceRepository({
    SupabaseClient? client,
    JournalWriteRepository? journalWrite,
  })  : _client = client ?? SupabaseBootstrap.client,
        _journalWrite = journalWrite ?? JournalWriteRepository();

  final SupabaseClient _client;
  final JournalWriteRepository _journalWrite;

  Future<({bool ok, String? error, String? skipped, String? saleId})>
      tryFinalizeStudioProductionAfterMobileInvoice(String productionId) async {
    try {
      final prod = await _client
          .from('studio_productions')
          .select(
            'id, company_id, branch_id, sale_id, production_no, status, '
            'generated_product_id, generated_invoice_item_id',
          )
          .eq('id', productionId)
          .maybeSingle();
      if (prod == null) return (ok: false, error: 'Production not found.', skipped: null, saleId: null);

      final saleId = prod['sale_id']?.toString();
      if (saleId == null || saleId.isEmpty) {
        return (ok: true, error: null, skipped: 'no_sale_id', saleId: null);
      }
      if (prod['generated_invoice_item_id'] == null) {
        return (ok: true, error: null, skipped: 'no_generated_invoice_item', saleId: null);
      }

      final stages = await _client
          .from('studio_production_stages')
          .select('id, status')
          .eq('production_id', productionId);
      final stageList = stages as List;
      if (stageList.isEmpty) {
        return (ok: true, error: null, skipped: 'no_stages', saleId: null);
      }
      final allDone = stageList.every(
        (s) => (s as Map)['status']?.toString().toLowerCase() == 'completed',
      );
      if (!allDone) {
        return (ok: true, error: null, skipped: 'stages_incomplete', saleId: null);
      }

      final companyId = prod['company_id']?.toString() ?? '';
      final branchId = prod['branch_id']?.toString();

      final sale = await _client
          .from('sales')
          .select('id, status, total, paid_amount, invoice_no, order_no')
          .eq('id', saleId)
          .maybeSingle();
      if (sale == null) {
        return (ok: false, error: 'Linked sale not found.', skipped: null, saleId: null);
      }

      final saleStatus = sale['status']?.toString().toLowerCase() ?? '';
      final prodStatus = prod['status']?.toString().toLowerCase() ?? '';
      if (saleStatus == 'final' && prodStatus == 'completed') {
        final docJe = await _hasActiveSaleDocumentJe(companyId, saleId);
        if (docJe) {
          return (ok: true, error: null, skipped: 'already_finalized', saleId: saleId);
        }
      }

      await _postPendingStageCosts(
        companyId: companyId,
        branchId: branchId,
        productionId: productionId,
        productionNo: prod['production_no']?.toString() ?? '',
      );

      final stagesFull = await _client
          .from('studio_production_stages')
          .select('id, assigned_worker_id, cost, status')
          .eq('production_id', productionId);

      var studioCharges = 0.0;
      for (final st in stagesFull as List) {
        final m = st as Map;
        if (m['status']?.toString().toLowerCase() == 'completed') {
          studioCharges += (m['cost'] as num?)?.toDouble() ?? 0;
        }
      }

      for (final st in stagesFull as List) {
        final m = st as Map;
        if (m['status']?.toString().toLowerCase() != 'completed') continue;
        final amount = (m['cost'] as num?)?.toDouble() ?? 0;
        final workerId = m['assigned_worker_id']?.toString();
        if (workerId == null || amount <= 0) continue;
        await _ensureWorkerLedgerRow(
          companyId: companyId,
          branchId: branchId,
          productionNo: prod['production_no']?.toString() ?? '',
          stageId: m['id']?.toString() ?? '',
          workerId: workerId,
          amount: amount,
        );
      }

      try {
        await _ensureStudioProductionInForSale(saleId);
      } catch (_) {}

      final currentTotal = (sale['total'] as num?)?.toDouble() ?? 0;
      final paidAmount = (sale['paid_amount'] as num?)?.toDouble() ?? 0;
      final dueAmount = (currentTotal - paidAmount).clamp(0, double.infinity);

      final saleUpdate = <String, dynamic>{
        'studio_charges': studioCharges,
        'due_amount': dueAmount,
        'status': 'final',
        'updated_at': DateTime.now().toIso8601String(),
      };
      if (sale['invoice_no'] == null && sale['order_no'] != null) {
        saleUpdate['invoice_no'] = sale['order_no'];
      }

      await _client.from('sales').update(saleUpdate).eq('id', saleId);

      final genProductId = prod['generated_product_id']?.toString();
      if (genProductId != null && studioCharges > 0) {
        await _client.from('products').update({'cost_price': studioCharges}).eq('id', genProductId);
      }

      try {
        await _client.rpc('record_sale_with_accounting', params: {'p_sale_id': saleId});
      } catch (_) {}

      final completedAt = DateTime.now().toIso8601String();
      await _client.from('studio_productions').update({
        'status': 'completed',
        'completed_at': completedAt,
        'updated_at': completedAt,
      }).eq('id', productionId);

      return (ok: true, error: null, skipped: null, saleId: saleId);
    } catch (e) {
      return (ok: false, error: e.toString(), skipped: null, saleId: null);
    }
  }

  Future<bool> _hasActiveSaleDocumentJe(String companyId, String saleId) async {
    final rows = await _client
        .from('journal_entries')
        .select('id, is_void')
        .eq('company_id', companyId)
        .eq('reference_type', 'sale')
        .eq('reference_id', saleId)
        .isFilter('payment_id', null)
        .limit(12);
    for (final r in rows as List) {
      if ((r as Map)['is_void'] != true) return true;
    }
    return false;
  }

  Future<String?> _accountIdByCode(String companyId, String code) async {
    final row = await _client
        .from('accounts')
        .select('id')
        .eq('company_id', companyId)
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();
    return row?['id']?.toString();
  }

  Future<String?> _resolveWorkerPayableAccountId(String companyId, String? workerContactId) async {
    final controlId = await _accountIdByCode(companyId, '2010');
    if (controlId == null) return null;
    if (workerContactId == null) return controlId;
    final child = await _client
        .from('accounts')
        .select('id')
        .eq('company_id', companyId)
        .eq('linked_contact_id', workerContactId)
        .eq('parent_id', controlId)
        .eq('is_active', true)
        .maybeSingle();
    return child?['id']?.toString() ?? controlId;
  }

  Future<void> _postPendingStageCosts({
    required String companyId,
    required String? branchId,
    required String productionId,
    required String productionNo,
  }) async {
    final stageRows = await _client
        .from('studio_production_stages')
        .select('id, status, cost, assigned_worker_id, stage_type, journal_entry_id')
        .eq('production_id', productionId);

    final cost5000 = await _accountIdByCode(companyId, '5000');
    if (cost5000 == null) return;

    for (final s in stageRows as List) {
      final m = s as Map;
      if (m['status']?.toString().toLowerCase() != 'completed') continue;
      final cost = (m['cost'] as num?)?.toDouble() ?? 0;
      final workerId = m['assigned_worker_id']?.toString();
      if (cost <= 0 || workerId == null) continue;
      if (m['journal_entry_id'] != null) continue;

      final stageId = m['id']?.toString() ?? '';
      final stageType = m['stage_type']?.toString() ?? 'stage';
      final payableId = await _resolveWorkerPayableAccountId(companyId, workerId);
      if (payableId == null) continue;

      final je = await _journalWrite.createJournalEntry(
        companyId: companyId,
        branchId: branchId ?? '',
        entryDate: DateTime.now().toIso8601String().substring(0, 10),
        description: 'Studio production $productionNo – $stageType stage completed',
        referenceType: 'studio_production_stage',
        referenceId: stageId,
        lines: [
          JournalLineInput(
            accountId: cost5000,
            debit: cost,
            credit: 0,
            description: 'Production cost – $stageType',
          ),
          JournalLineInput(
            accountId: payableId,
            debit: 0,
            credit: cost,
            description: 'Worker payable – $stageType',
          ),
        ],
      );

      if (je.id != null) {
        await _client
            .from('studio_production_stages')
            .update({'journal_entry_id': je.id})
            .eq('id', stageId);
        await _ensureWorkerLedgerRow(
          companyId: companyId,
          branchId: branchId,
          productionNo: productionNo,
          stageId: stageId,
          workerId: workerId,
          amount: cost,
        );
      }
    }
  }

  Future<void> _ensureWorkerLedgerRow({
    required String companyId,
    required String? branchId,
    required String productionNo,
    required String stageId,
    required String workerId,
    required double amount,
  }) async {
    final existing = await _client
        .from('worker_ledger_entries')
        .select('id')
        .eq('reference_type', 'studio_production_stage')
        .eq('reference_id', stageId)
        .limit(1)
        .maybeSingle();
    if (existing != null) return;

    await _client.from('worker_ledger_entries').insert({
      'company_id': companyId,
      'worker_id': workerId,
      'amount': amount,
      'reference_type': 'studio_production_stage',
      'reference_id': stageId,
      'notes': 'Studio production $productionNo – stage completed',
      'status': 'unpaid',
    });
  }

  Future<void> _ensureStudioProductionInForSale(String saleId) async {
    const studioInTypes = ['PRODUCTION_IN', 'PRODUCTION', 'production'];
    const qty = 1.0;

    final sale = await _client
        .from('sales')
        .select('id, company_id, branch_id')
        .eq('id', saleId)
        .maybeSingle();
    if (sale == null) return;

    final prods = await _client
        .from('studio_productions')
        .select('id, production_no, branch_id')
        .eq('sale_id', saleId)
        .order('created_at')
        .limit(1);
    if ((prods as List).isEmpty) return;
    final production = prods.first as Map;

    final items = await _client
        .from('sales_items')
        .select('id, product_id, is_studio_product')
        .eq('sale_id', saleId);
    Map? studioItem;
    for (final i in items as List) {
      if ((i as Map)['is_studio_product'] == true) {
        studioItem = i;
        break;
      }
    }
    if (studioItem?['product_id'] == null) return;
    final productId = studioItem!['product_id']?.toString() ?? '';

    final existingRows = await _client
        .from('stock_movements')
        .select('id, quantity')
        .eq('reference_type', 'studio_production')
        .eq('product_id', productId)
        .inFilter('movement_type', studioInTypes)
        .eq('reference_id', production['id']);
    for (final r in existingRows as List) {
      if ((((r as Map)['quantity'] as num?)?.toDouble() ?? 0) > 0) return;
    }

    final stageRows = await _client
        .from('studio_production_stages')
        .select('status, cost, expected_cost')
        .eq('production_id', production['id']);

    var productionCost = 0.0;
    for (final s in stageRows as List) {
      final m = s as Map;
      final st = m['status']?.toString().toLowerCase() ?? '';
      productionCost += st == 'completed'
          ? ((m['cost'] as num?)?.toDouble() ?? 0)
          : ((m['expected_cost'] as num?)?.toDouble() ?? 0);
    }

    if (productionCost <= 0) {
      final prodRow = await _client.from('products').select('cost_price').eq('id', productId).maybeSingle();
      productionCost = (prodRow?['cost_price'] as num?)?.toDouble() ?? 0;
    }
    if (productionCost <= 0) return;

    final companyId = sale['company_id']?.toString() ?? '';
    final branchId = sale['branch_id']?.toString() ?? production['branch_id']?.toString();
    final user = _client.auth.currentUser;

    await _client.from('stock_movements').insert({
      'company_id': companyId,
      'branch_id': branchId,
      'product_id': productId,
      'variation_id': null,
      'movement_type': 'PRODUCTION_IN',
      'quantity': qty,
      'unit_cost': productionCost / qty,
      'total_cost': productionCost,
      'reference_type': 'studio_production',
      'reference_id': production['id'],
      'notes': 'Studio finished goods IN — ${production['production_no'] ?? saleId.substring(0, 8)}',
      'created_by': user?.id,
    });
  }
}
