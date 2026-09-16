import '../../core/supabase/supabase_bootstrap.dart';
import '../../core/utils/branch_id.dart';
import '../local/list_cache_store.dart';
import '../models/contact.dart';

class ContactsRepository {
  final _client = SupabaseBootstrap.client;
  final _listCache = ListCacheStore();

  List<ContactRoleFilter> _typeToRoles(String type) {
    switch (type) {
      case 'customer':
        return [ContactRoleFilter.customer];
      case 'supplier':
        return [ContactRoleFilter.supplier];
      case 'worker':
        return [ContactRoleFilter.worker];
      case 'both':
        return [ContactRoleFilter.customer, ContactRoleFilter.supplier];
      default:
        return [ContactRoleFilter.customer];
    }
  }

  Future<Map<String, _BalanceSlice>> _fetchPartyGlBalances(
    String companyId,
    String? branchId,
  ) async {
    final map = <String, _BalanceSlice>{};
    try {
      final data = await _client.rpc(
        'get_contact_party_gl_balances',
        params: {
          'p_company_id': companyId,
          'p_branch_id': safeRpcBranchId(branchId),
        },
      );
      if (data is List) {
        for (final row in data) {
          if (row is! Map) continue;
          final id = row['contact_id']?.toString();
          if (id == null) continue;
          map[id] = _BalanceSlice(
            ar: _num(row['gl_ar_receivable']),
            ap: _num(row['gl_ap_payable']),
            worker: _num(row['gl_worker_payable']),
          );
        }
      }
    } catch (_) {
      // RLS or RPC unavailable — balances stay at opening_balance
    }
    return map;
  }

  double _balanceForRole(
    _BalanceSlice? slice,
    String type,
    ContactRoleFilter? listRole,
    double opening,
  ) {
    if (slice == null) return opening;
    if (listRole == ContactRoleFilter.customer) {
      return slice.ar > 0 ? slice.ar : opening;
    }
    if (listRole == ContactRoleFilter.supplier) {
      return slice.ap > 0 ? slice.ap : opening;
    }
    if (listRole == ContactRoleFilter.worker) {
      return slice.worker > 0 ? slice.worker : opening;
    }
    final t = type.toLowerCase();
    if (t == 'supplier') return slice.ap > 0 ? slice.ap : opening;
    if (t == 'worker') return slice.worker > 0 ? slice.worker : opening;
    return slice.ar > 0 ? slice.ar : opening;
  }

  Future<({List<Contact> contacts, String? error})> getContacts({
    required String companyId,
    ContactRoleFilter? type,
    String? branchId,
    bool includeBalances = true,
  }) async {
    final filterKey = type?.name ?? 'all';
    try {
      var query = _client
          .from('contacts')
          .select(
            'id, company_id, type, name, phone, mobile, email, city, address, opening_balance, credit_limit, is_active, code, is_system_generated',
          )
          .eq('company_id', companyId);

      if (type == ContactRoleFilter.customer) {
        query = query.inFilter('type', ['customer', 'both']);
      } else if (type == ContactRoleFilter.supplier) {
        query = query.inFilter('type', ['supplier', 'both']);
      } else if (type == ContactRoleFilter.worker) {
        query = query.eq('type', 'worker');
      }

      final data = await query.order('name');
      final rowMaps = (data as List)
          .map((row) => Map<String, dynamic>.from(row as Map))
          .toList();
      await _listCache.putContacts(companyId, filterKey, rowMaps);

      final contacts = await _mapContactRows(
        rowMaps,
        companyId: companyId,
        type: type,
        branchId: branchId,
        includeBalances: includeBalances,
      );
      return (contacts: contacts, error: null);
    } catch (e) {
      final cached = await _listCache.getContacts(companyId, filterKey);
      if (cached == null || cached.isEmpty) {
        return (contacts: <Contact>[], error: e.toString());
      }
      final contacts = await _mapContactRows(
        cached,
        companyId: companyId,
        type: type,
        branchId: branchId,
        includeBalances: false,
      );
      return (contacts: contacts, error: 'Offline — showing cached contacts.');
    }
  }

  Future<List<Contact>> _mapContactRows(
    List<Map<String, dynamic>> rowMaps, {
    required String companyId,
    ContactRoleFilter? type,
    String? branchId,
    required bool includeBalances,
  }) async {
    final glMap = includeBalances
        ? await _fetchPartyGlBalances(companyId, branchId)
        : <String, _BalanceSlice>{};

    return rowMaps.map((map) {
      final id = map['id'] as String;
      final contactType = map['type'] as String? ?? 'customer';
      final opening = _num(map['opening_balance']);
      final slice = glMap[id];
      final balance = includeBalances
          ? _balanceForRole(slice, contactType, type, opening)
          : 0.0;

      return Contact(
        id: id,
        name: map['name'] as String? ?? '—',
        roles: _typeToRoles(contactType),
        phone: map['phone'] as String? ?? '',
        mobile: map['mobile'] as String?,
        email: map['email'] as String?,
        address: map['address'] as String?,
        city: map['city'] as String?,
        balance: balance,
        creditLimit: _numOrNull(map['credit_limit']),
        status: map['is_active'] == false
            ? ContactStatus.inactive
            : ContactStatus.active,
        code: map['code'] as String?,
        type: contactType,
        isSystemGenerated: map['is_system_generated'] == true,
      );
    }).toList();
  }

  Future<({Contact? contact, String? error})> getContactById({
    required String companyId,
    required String contactId,
    String? branchId,
    bool includeBalances = true,
  }) async {
    final row = await _client
        .from('contacts')
        .select(
          'id, company_id, type, name, phone, mobile, email, city, address, opening_balance, credit_limit, is_active, code, is_system_generated',
        )
        .eq('company_id', companyId)
        .eq('id', contactId)
        .maybeSingle();

    if (row == null) {
      return (contact: null, error: 'Contact not found or access denied.');
    }

    final map = Map<String, dynamic>.from(row);
    final contactType = map['type'] as String? ?? 'customer';
    final opening = _num(map['opening_balance']);
    double balance = opening;
    if (includeBalances) {
      final glMap = await _fetchPartyGlBalances(companyId, branchId);
      balance = _balanceForRole(
        glMap[map['id'] as String],
        contactType,
        null,
        opening,
      );
    }

    return (
      contact: Contact(
        id: map['id'] as String,
        name: map['name'] as String? ?? '—',
        roles: _typeToRoles(contactType),
        phone: map['phone'] as String? ?? '',
        mobile: map['mobile'] as String?,
        email: map['email'] as String?,
        address: map['address'] as String?,
        city: map['city'] as String?,
        balance: balance,
        creditLimit: _numOrNull(map['credit_limit']),
        status: map['is_active'] == false
            ? ContactStatus.inactive
            : ContactStatus.active,
        code: map['code'] as String?,
        type: contactType,
        isSystemGenerated: map['is_system_generated'] == true,
      ),
      error: null,
    );
  }

  double _num(dynamic v) => v == null ? 0 : (num.tryParse(v.toString()) ?? 0).toDouble();

  double? _numOrNull(dynamic v) {
    if (v == null) return null;
    return (num.tryParse(v.toString()) ?? 0).toDouble();
  }
}

class _BalanceSlice {
  _BalanceSlice({required this.ar, required this.ap, required this.worker});
  final double ar;
  final double ap;
  final double worker;
}
