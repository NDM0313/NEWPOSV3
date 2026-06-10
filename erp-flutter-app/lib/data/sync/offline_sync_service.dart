import '../repositories/sales_write_repository.dart';
import '../local/offline_pending_store.dart';

class OfflineSyncService {
  OfflineSyncService({
    required SalesWriteRepository salesWrite,
    OfflinePendingStore? store,
  })  : _salesWrite = salesWrite,
        _store = store ?? OfflinePendingStore();

  final SalesWriteRepository _salesWrite;
  final OfflinePendingStore _store;

  Future<({int synced, int failed, String? lastError})> runSync() async {
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
        final itemsRaw = p['items'] as List? ?? [];
        final items = itemsRaw.map((row) {
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

      case PendingType.posSale:
        final itemsRaw = p['items'] as List? ?? [];
        final items = itemsRaw.map((row) {
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
  }
}
