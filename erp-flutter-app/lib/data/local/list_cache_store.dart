import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Read-through list cache (Capacitor `listCache` parity — products first).
class ListCacheStore {
  static String productsKey(String companyId) => 'list_cache_products_$companyId';

  static String contactsKey(String companyId, String filter) =>
      'list_cache_contacts_${companyId}_$filter';

  Future<void> putProducts(String companyId, List<Map<String, dynamic>> rows) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      productsKey(companyId),
      jsonEncode({
        'saved_at': DateTime.now().millisecondsSinceEpoch,
        'rows': rows,
      }),
    );
  }

  Future<List<Map<String, dynamic>>?> getProducts(String companyId) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(productsKey(companyId));
    if (raw == null) return null;
    final map = jsonDecode(raw) as Map<String, dynamic>;
    final rows = map['rows'];
    if (rows is! List) return null;
    return rows.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<void> putContacts(
    String companyId,
    String filter,
    List<Map<String, dynamic>> rows,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      contactsKey(companyId, filter),
      jsonEncode({
        'saved_at': DateTime.now().millisecondsSinceEpoch,
        'rows': rows,
      }),
    );
  }

  Future<List<Map<String, dynamic>>?> getContacts(String companyId, String filter) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(contactsKey(companyId, filter));
    if (raw == null) return null;
    final map = jsonDecode(raw) as Map<String, dynamic>;
    final rows = map['rows'];
    if (rows is! List) return null;
    return rows.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }
}
