import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'tables.dart';

part 'database.g.dart';

@DriftDatabase(tables: [OfflinePendingRows, ListCacheEntries, FormDraftRows, CounterWorkerRows, DbMeta])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  AppDatabase.forTesting(super.e);

  @override
  int get schemaVersion => 1;

  static AppDatabase? _instance;

  static AppDatabase get instance {
    _instance ??= AppDatabase();
    return _instance!;
  }

  static QueryExecutor _openConnection() {
    return driftDatabase(name: 'erp_flutter_local');
  }

  /// One-time import from legacy SharedPreferences offline queue + list cache keys.
  Future<void> migrateFromSharedPreferencesIfNeeded() async {
    final migrated = await (select(dbMeta)..where((t) => t.id.equals('prefs_migrated')))
        .getSingleOrNull();
    if (migrated != null) return;

    final prefs = await SharedPreferences.getInstance();

    final pendingRaw = prefs.getString('erp_flutter_offline_pending');
    if (pendingRaw != null && pendingRaw.isNotEmpty) {
      final list = jsonDecode(pendingRaw) as List;
      for (final row in list) {
        final m = Map<String, dynamic>.from(row as Map);
        await into(offlinePendingRows).insertOnConflictUpdate(
          OfflinePendingRowsCompanion.insert(
            id: m['id'] as String,
            type: m['type'] as String,
            payloadJson: jsonEncode(m['payload']),
            companyId: m['company_id'] as String,
            branchId: m['branch_id'] as String,
            createdAt: m['created_at'] as int,
            status: m['status'] as String? ?? 'pending',
            syncError: Value(m['sync_error'] as String?),
          ),
        );
      }
    }

    for (final key in prefs.getKeys()) {
      if (key.startsWith('list_cache_')) {
        final raw = prefs.getString(key);
        if (raw == null) continue;
        await into(listCacheEntries).insertOnConflictUpdate(
          ListCacheEntriesCompanion.insert(
            cacheKey: key,
            jsonPayload: raw,
            updatedAt: DateTime.now().millisecondsSinceEpoch,
          ),
        );
      }
    }

    await into(dbMeta).insertOnConflictUpdate(
      DbMetaCompanion.insert(id: 'prefs_migrated', value: DateTime.now().toIso8601String()),
    );
  }
}
