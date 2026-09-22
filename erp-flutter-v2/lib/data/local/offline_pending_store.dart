import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

enum PendingType {
  draftSale,
  posSale,
  expense,
  draftPurchase,
  salePayment,
  purchasePayment,
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

class OfflinePendingStore {
  static const _key = 'erp_flutter_offline_pending';

  Future<List<PendingRecord>> getAll() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return [];
    final list = jsonDecode(raw) as List;
    return list
        .map((e) => PendingRecord.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<String> add({
    required PendingType type,
    required Map<String, dynamic> payload,
    required String companyId,
    required String branchId,
  }) async {
    final id = 'local-${DateTime.now().millisecondsSinceEpoch}';
    final record = PendingRecord(
      id: id,
      type: type,
      payload: payload,
      companyId: companyId,
      branchId: branchId,
      createdAt: DateTime.now().millisecondsSinceEpoch,
    );
    final all = await getAll();
    all.add(record);
    await _save(all);
    return id;
  }

  Future<void> update(PendingRecord record) async {
    final all = await getAll();
    final idx = all.indexWhere((r) => r.id == record.id);
    if (idx >= 0) {
      all[idx] = record;
      await _save(all);
    }
  }

  Future<void> remove(String id) async {
    final all = await getAll();
    all.removeWhere((r) => r.id == id);
    await _save(all);
  }

  Future<int> pendingCount() async {
    final all = await getAll();
    return all.where(
      (r) => r.status == SyncQueueStatus.pending || r.status == SyncQueueStatus.error,
    ).length;
  }

  Future<void> _save(List<PendingRecord> records) async {
    final prefs = await SharedPreferences.getInstance();
    final encoded = jsonEncode(records.map((r) => r.toJson()).toList());
    await prefs.setString(_key, encoded);
  }
}
