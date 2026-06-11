import '../local/offline_pending_store.dart';
import '../repositories/expenses_write_repository.dart';
import '../repositories/journal_write_repository.dart';
import '../repositories/purchases_write_repository.dart';
import '../repositories/sales_write_repository.dart';

class OfflineSyncService {
  OfflineSyncService({
    required SalesWriteRepository salesWrite,
    required ExpensesWriteRepository expensesWrite,
    required PurchasesWriteRepository purchasesWrite,
    required JournalWriteRepository journalWrite,
    OfflinePendingStore? store,
  })  : _salesWrite = salesWrite,
        _expensesWrite = expensesWrite,
        _purchasesWrite = purchasesWrite,
        _journalWrite = journalWrite,
        _store = store ?? OfflinePendingStore();

  final SalesWriteRepository _salesWrite;
  final ExpensesWriteRepository _expensesWrite;
  final PurchasesWriteRepository _purchasesWrite;
  final JournalWriteRepository _journalWrite;
  final OfflinePendingStore _store;

  Future<({int synced, int failed, String? lastError})> runSync() async {
    await _store.ensureReady();
    final all = await _store.getAll();
    int synced = 0;
    int failed = 0;
    String? lastError;

    for (final record in all) {
      if (record.status != SyncQueueStatus.pending &&
          record.status != SyncQueueStatus.error) {
        continue;
      }

      await _store.update(record.copyWith(status: SyncQueueStatus.syncing));

      try {
        final ok = await _syncRecord(record);
        if (ok) {
          await _store.remove(record.id);
          synced++;
        } else {
          failed++;
        }
      } catch (e) {
        lastError = e.toString();
        await _store.update(
          record.copyWith(status: SyncQueueStatus.error, syncError: lastError),
        );
        failed++;
      }
    }

    return (synced: synced, failed: failed, lastError: lastError);
  }

  Future<bool> _syncRecord(PendingRecord record) async {
    final p = record.payload;

    switch (record.type) {
      case PendingType.draftSale:
        return _syncDraftSale(record, p);
      case PendingType.posSale:
        return _syncPosSale(record, p);
      case PendingType.expense:
        return _syncExpense(record, p);
      case PendingType.draftPurchase:
        return _syncDraftPurchase(record, p);
      case PendingType.salePayment:
        return _syncSalePayment(record, p);
      case PendingType.purchasePayment:
        return _syncPurchasePayment(record, p);
      case PendingType.journalEntry:
        return _syncJournalEntry(record, p);
      case PendingType.purchaseCancel:
        return _syncPurchaseCancel(record, p);
    }
  }

  Future<bool> _syncJournalEntry(PendingRecord record, Map<String, dynamic> p) async {
    final linesRaw = p['lines'] as List? ?? [];
    final lines = linesRaw.map((row) {
      final m = Map<String, dynamic>.from(row as Map);
      return JournalLineInput(
        accountId: m['account_id'] as String,
        debit: (m['debit'] as num).toDouble(),
        credit: (m['credit'] as num).toDouble(),
        description: m['description'] as String?,
      );
    }).toList();

    final result = await _journalWrite.createJournalEntry(
      companyId: p['company_id'] as String,
      branchId: p['branch_id'] as String,
      entryDate: p['entry_date'] as String,
      description: p['description'] as String,
      referenceType: p['reference_type'] as String? ?? 'manual',
      referenceId: p['reference_id'] as String?,
      userId: p['created_by'] as String?,
      lines: lines,
    );

    if (result.error != null) {
      await _store.update(
        record.copyWith(status: SyncQueueStatus.error, syncError: result.error),
      );
      return false;
    }
    return true;
  }

  Future<bool> _syncPurchaseCancel(PendingRecord record, Map<String, dynamic> p) async {
    final result = await _purchasesWrite.cancelPurchase(
      purchaseId: p['purchase_id'] as String,
      userId: p['created_by'] as String?,
    );
    if (!result.success) {
      await _store.update(
        record.copyWith(status: SyncQueueStatus.error, syncError: result.error),
      );
      return false;
    }
    return true;
  }

  Future<bool> _syncSalePayment(PendingRecord record, Map<String, dynamic> p) async {
    final result = await _salesWrite.recordSalePaymentReceived(
      companyId: p['company_id'] as String,
      branchId: p['branch_id'] as String,
      saleId: p['sale_id'] as String,
      amount: (p['amount'] as num).toDouble(),
      createdBy: p['created_by'] as String,
    );
    if (!result.success) {
      await _store.update(
        record.copyWith(status: SyncQueueStatus.error, syncError: result.error),
      );
      return false;
    }
    return true;
  }

  Future<bool> _syncPurchasePayment(PendingRecord record, Map<String, dynamic> p) async {
    final result = await _purchasesWrite.recordSupplierPayment(
      companyId: p['company_id'] as String,
      branchId: p['branch_id'] as String,
      purchaseId: p['purchase_id'] as String,
      amount: (p['amount'] as num).toDouble(),
      createdBy: p['created_by'] as String,
    );
    if (!result.success) {
      await _store.update(
        record.copyWith(status: SyncQueueStatus.error, syncError: result.error),
      );
      return false;
    }
    return true;
  }

  Future<bool> _syncDraftSale(PendingRecord record, Map<String, dynamic> p) async {
    final items = _mapSaleItems(p['items'] as List? ?? []);
    final result = await _salesWrite.createDraftSale(
      companyId: p['company_id'] as String,
      branchId: p['branch_id'] as String,
      createdBy: p['created_by'] as String,
      customerName: p['customer_name'] as String? ?? 'Walk-in',
      customerId: p['customer_id'] as String?,
      items: items,
    );
    if (result.error != null) {
      await _store.update(
        record.copyWith(status: SyncQueueStatus.error, syncError: result.error),
      );
      return false;
    }
    return true;
  }

  Future<bool> _syncPosSale(PendingRecord record, Map<String, dynamic> p) async {
    final items = _mapSaleItems(p['items'] as List? ?? []);
    final pos = await _salesWrite.createPosSale(
      companyId: p['company_id'] as String,
      branchId: p['branch_id'] as String,
      createdBy: p['created_by'] as String,
      customerName: p['customer_name'] as String? ?? 'Walk-in',
      items: items,
    );
    if (pos.error != null && pos.saleId == null) {
      await _store.update(
        record.copyWith(status: SyncQueueStatus.error, syncError: pos.error),
      );
      return false;
    }
    return true;
  }

  Future<bool> _syncExpense(PendingRecord record, Map<String, dynamic> p) async {
    final result = await _expensesWrite.createExpense(
      companyId: p['company_id'] as String,
      branchId: p['branch_id'] as String,
      createdBy: p['created_by'] as String,
      category: p['category'] as String? ?? 'General',
      description: p['description'] as String? ?? '',
      amount: (p['amount'] as num).toDouble(),
    );
    if (result.error != null) {
      await _store.update(
        record.copyWith(status: SyncQueueStatus.error, syncError: result.error),
      );
      return false;
    }
    return true;
  }

  Future<bool> _syncDraftPurchase(PendingRecord record, Map<String, dynamic> p) async {
    final itemsRaw = p['items'] as List? ?? [];
    final items = itemsRaw.map((row) {
      final m = Map<String, dynamic>.from(row as Map);
      return DraftPurchaseLineInput(
        productId: m['product_id'] as String,
        productName: m['product_name'] as String,
        sku: m['sku'] as String,
        quantity: (m['quantity'] as num).toDouble(),
        unitPrice: (m['unit_price'] as num).toDouble(),
        total: (m['total'] as num).toDouble(),
      );
    }).toList();

    final result = await _purchasesWrite.createDraftPurchase(
      companyId: p['company_id'] as String,
      branchId: p['branch_id'] as String,
      createdBy: p['created_by'] as String,
      supplierName: p['supplier_name'] as String? ?? 'Unknown',
      items: items,
    );
    if (result.error != null) {
      await _store.update(
        record.copyWith(status: SyncQueueStatus.error, syncError: result.error),
      );
      return false;
    }
    return true;
  }

  List<DraftSaleLineInput> _mapSaleItems(List rows) {
    return rows.map((row) {
      final m = Map<String, dynamic>.from(row as Map);
      return DraftSaleLineInput(
        productId: m['product_id'] as String,
        productName: m['product_name'] as String,
        sku: m['sku'] as String,
        quantity: (m['quantity'] as num).toDouble(),
        unitPrice: (m['unit_price'] as num).toDouble(),
        total: (m['total'] as num).toDouble(),
      );
    }).toList();
  }
}
