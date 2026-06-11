import 'dart:convert';

import 'db/database.dart';

/// Drift-backed read-through list cache (Capacitor listCache parity).
class ListCacheStore {
  ListCacheStore({AppDatabase? db}) : _db = db ?? AppDatabase.instance;

  final AppDatabase _db;

  static String productsKey(String companyId) => 'list_cache_products_$companyId';

  static String contactsKey(String companyId, String filter) =>
      'list_cache_contacts_${companyId}_$filter';

  static String branchesKey(String companyId) => 'list_cache_br_$companyId';

  static String paymentAccountsKey(String companyId) => 'list_cache_pa_$companyId';

  Future<void> _put(String key, Map<String, dynamic> envelope) async {
    await _db.into(_db.listCacheEntries).insertOnConflictUpdate(
          ListCacheEntriesCompanion.insert(
            cacheKey: key,
            jsonPayload: jsonEncode(envelope),
            updatedAt: DateTime.now().millisecondsSinceEpoch,
          ),
        );
  }

  Future<Map<String, dynamic>?> _get(String key) async {
    final row = await (_db.select(_db.listCacheEntries)..where((t) => t.cacheKey.equals(key)))
        .getSingleOrNull();
    if (row == null) return null;
    return jsonDecode(row.jsonPayload) as Map<String, dynamic>;
  }

  Future<void> putProducts(String companyId, List<Map<String, dynamic>> rows) async {
    await _put(productsKey(companyId), {
      'saved_at': DateTime.now().millisecondsSinceEpoch,
      'rows': rows,
    });
  }

  Future<List<Map<String, dynamic>>?> getProducts(String companyId) async {
    final map = await _get(productsKey(companyId));
    if (map == null) return null;
    final rows = map['rows'];
    if (rows is! List) return null;
    return rows.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<void> putContacts(
    String companyId,
    String filter,
    List<Map<String, dynamic>> rows,
  ) async {
    await _put(contactsKey(companyId, filter), {
      'saved_at': DateTime.now().millisecondsSinceEpoch,
      'rows': rows,
    });
  }

  Future<List<Map<String, dynamic>>?> getContacts(String companyId, String filter) async {
    final map = await _get(contactsKey(companyId, filter));
    if (map == null) return null;
    final rows = map['rows'];
    if (rows is! List) return null;
    return rows.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<void> putBranches(String companyId, List<Map<String, dynamic>> rows) async {
    await _put(branchesKey(companyId), {
      'saved_at': DateTime.now().millisecondsSinceEpoch,
      'rows': rows,
    });
  }

  Future<List<Map<String, dynamic>>?> getBranches(String companyId) async {
    final map = await _get(branchesKey(companyId));
    if (map == null) return null;
    final rows = map['rows'];
    if (rows is! List) return null;
    return rows.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<void> putPaymentAccounts(String companyId, List<Map<String, dynamic>> rows) async {
    await _put(paymentAccountsKey(companyId), {
      'saved_at': DateTime.now().millisecondsSinceEpoch,
      'rows': rows,
    });
  }

  Future<List<Map<String, dynamic>>?> getPaymentAccounts(String companyId) async {
    final map = await _get(paymentAccountsKey(companyId));
    if (map == null) return null;
    final rows = map['rows'];
    if (rows is! List) return null;
    return rows.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }
}
