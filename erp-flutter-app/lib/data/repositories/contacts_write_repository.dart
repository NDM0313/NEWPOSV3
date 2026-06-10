import '../../core/supabase/supabase_bootstrap.dart';

class ContactsWriteRepository {
  final _client = SupabaseBootstrap.client;

  String _rolesToType(String role) {
    switch (role) {
      case 'supplier':
        return 'supplier';
      case 'worker':
        return 'worker';
      default:
        return 'customer';
    }
  }

  String _codeTypeForBackend(String type) {
    if (type == 'supplier') return 'SUP';
    if (type == 'worker') return 'WRK';
    return 'CUS';
  }

  Future<({String? contactId, String? error})> createContact({
    required String companyId,
    required String name,
    required String role,
    String? phone,
    String? email,
    String? city,
    String? address,
  }) async {
    final trimmed = name.trim();
    if (trimmed.isEmpty) {
      return (contactId: null, error: 'Name is required.');
    }

    final type = _rolesToType(role);
    final codeType = _codeTypeForBackend(type);

    try {
      String? code;
      final codeRaw = await _client.rpc(
        'get_next_document_number_global',
        params: {'p_company_id': companyId, 'p_type': codeType},
      );
      if (codeRaw is String && codeRaw.trim().isNotEmpty) {
        code = codeRaw.trim();
      } else {
        return (contactId: null, error: 'Could not generate contact reference number.');
      }

      Map<String, dynamic>? inserted;
      for (var attempt = 0; attempt < 3; attempt++) {
        try {
          inserted = await _client
              .from('contacts')
              .insert({
                'company_id': companyId,
                'type': type,
                'name': trimmed,
                'phone': phone == null || phone.trim().isEmpty ? null : phone.trim(),
                'email': email == null || email.trim().isEmpty ? null : email.trim(),
                'city': city == null || city.trim().isEmpty ? null : city.trim(),
                'address': address == null || address.trim().isEmpty ? null : address.trim(),
                'opening_balance': 0,
                'is_active': true,
                'code': code,
              })
              .select('id')
              .maybeSingle();
          if (inserted != null) break;
        } catch (e) {
          final msg = e.toString();
          if (msg.contains('23505') || msg.contains('duplicate')) {
            final retry = await _client.rpc(
              'get_next_document_number_global',
              params: {'p_company_id': companyId, 'p_type': codeType},
            );
            if (retry is String && retry.trim().isNotEmpty) {
              code = retry.trim();
              continue;
            }
          }
          return (contactId: null, error: e.toString());
        }
      }

      if (inserted == null || inserted['id'] == null) {
        return (contactId: null, error: 'Failed to create contact.');
      }

      final contactId = inserted['id'].toString();
      try {
        await _client.rpc(
          'ensure_party_subledgers_for_contact',
          params: {'p_contact_id': contactId},
        );
      } catch (_) {
        // Non-fatal — matches mobile warn-only behavior
      }

      return (contactId: contactId, error: null);
    } catch (e) {
      return (contactId: null, error: e.toString());
    }
  }
}
