import 'dart:convert';

import 'package:drift/drift.dart';

import 'db/database.dart';

enum PendingType {
  draftSale,
  posSale,
  expense,
  draftPurchase,
  salePayment,
  purchasePayment,
  journalEntry,
  purchaseCancel,
}

enum SyncQueueStatus { pending, syncing, synced, error }

class PendingRecord {
  PendingRecord({
    required this.id,
    required this.type,
    required this.payload,
    required this.companyId,
    required this.branchId,
    required this.createdAt,
    this.status = SyncQueueStatus.pending,
    this.syncError,
  });

  final String id;
  final PendingType type;
  final Map<String, dynamic> payload;
  final String companyId;
  final String branchId;
  final int createdAt;
  final SyncQueueStatus status;
  final String? syncError;

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type.name,
        'payload': payload,
        'company_id': companyId,
        'branch_id': branchId,
        'created_at': createdAt,
        'status': status.name,
        'sync_error': syncError,
      };

  static PendingRecord fromJson(Map<String, dynamic> json) {
    return PendingRecord(
      id: json['id'] as String,
      type: PendingType.values.firstWhere(
        (t) => t.name == json['type'],
        orElse: () => PendingType.draftSale,
      ),
      payload: Map<String, dynamic>.from(json['payload'] as Map),
      companyId: json['company_id'] as String,
      branchId: json['branch_id'] as String,
      createdAt: json['created_at'] as int,
      status: SyncQueueStatus.values.firstWhere(
        (s) => s.name == json['status'],
        orElse: () => SyncQueueStatus.pending,
      ),
      syncError: json['sync_error'] as String?,
    );
  }

  PendingRecord copyWith({
    SyncQueueStatus? status,
    String? syncError,
  }) {
    return PendingRecord(
      id: id,
      type: type,
      payload: payload,
      companyId: companyId,
      branchId: branchId,
      createdAt: createdAt,
      status: status ?? this.status,
      syncError: syncError,
    );
  }
}

/// Drift-backed offline queue with one-time SharedPreferences migration.
class OfflinePendingStore {
  OfflinePendingStore({AppDatabase? db}) : _db = db ?? AppDatabase.instance;

  final AppDatabase _db;

  Future<void> ensureReady() async {
    await _db.migrateFromSharedPreferencesIfNeeded();
  }

  Future<List<PendingRecord>> getAll() async {
    await ensureReady();
    final rows = await _db.select(_db.offlinePendingRows).get();
    return rows.map(_fromRow).toList();
  }

  Future<String> add({
    required PendingType type,
    required Map<String, dynamic> payload,
    required String companyId,
    required String branchId,
  }) async {
    await ensureReady();
    final id = 'local-${DateTime.now().millisecondsSinceEpoch}';
    await _db.into(_db.offlinePendingRows).insert(
          OfflinePendingRowsCompanion.insert(
            id: id,
            type: type.name,
            payloadJson: jsonEncode(payload),
            companyId: companyId,
            branchId: branchId,
            createdAt: DateTime.now().millisecondsSinceEpoch,
            status: SyncQueueStatus.pending.name,
          ),
        );
    return id;
  }

  Future<void> update(PendingRecord record) async {
    await ensureReady();
    await (_db.update(_db.offlinePendingRows)..where((t) => t.id.equals(record.id))).write(
      OfflinePendingRowsCompanion(
        status: Value(record.status.name),
        syncError: Value(record.syncError),
      ),
    );
  }

  Future<void> remove(String id) async {
    await ensureReady();
    await (_db.delete(_db.offlinePendingRows)..where((t) => t.id.equals(id))).go();
  }

  Future<int> pendingCount() async {
    await ensureReady();
    final rows = await _db.select(_db.offlinePendingRows).get();
    return rows
        .where(
          (r) => r.status == SyncQueueStatus.pending.name || r.status == SyncQueueStatus.error.name,
        )
        .length;
  }

  PendingRecord _fromRow(OfflinePendingRow row) {
    return PendingRecord(
      id: row.id,
      type: PendingType.values.firstWhere(
        (t) => t.name == row.type,
        orElse: () => PendingType.draftSale,
      ),
      payload: Map<String, dynamic>.from(jsonDecode(row.payloadJson) as Map),
      companyId: row.companyId,
      branchId: row.branchId,
      createdAt: row.createdAt,
      status: SyncQueueStatus.values.firstWhere(
        (s) => s.name == row.status,
        orElse: () => SyncQueueStatus.pending,
      ),
      syncError: row.syncError,
    );
  }
}
