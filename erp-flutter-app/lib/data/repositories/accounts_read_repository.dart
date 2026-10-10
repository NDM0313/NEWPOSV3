import '../../core/supabase/supabase_bootstrap.dart';

class AccountListItem {
  const AccountListItem({
    required this.id,
    required this.code,
    required this.name,
    required this.type,
    required this.balance,
  });

  final String id;
  final String code;
  final String name;
  final String type;
  final double balance;
}

class AccountsReadRepository {
  final _client = SupabaseBootstrap.client;

  Future<({List<AccountListItem> accounts, String? error})> getAccounts({
    required String companyId,
  }) async {
    try {
      final data = await _client
          .from('accounts')
          .select('id, code, name, type, balance')
          .eq('company_id', companyId)
          .order('code')
          .limit(200);

      final accounts = (data as List).map((row) {
        final map = Map<String, dynamic>.from(row as Map);
        return AccountListItem(
          id: map['id'] as String,
          code: map['code'] as String? ?? '—',
          name: map['name'] as String? ?? '—',
          type: map['type'] as String? ?? '—',
          balance: _num(map['balance']),
        );
      }).toList();

      return (accounts: accounts, error: null);
    } catch (e) {
      return (accounts: <AccountListItem>[], error: e.toString());
    }
  }

  double _num(dynamic v) =>
      v == null ? 0 : (num.tryParse(v.toString()) ?? 0).toDouble();
}
