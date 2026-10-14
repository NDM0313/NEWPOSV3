import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/supabase/supabase_bootstrap.dart';

/// Party AR sub-ledger + rental revenue JE parity with Capacitor mobile.
class RentalBookingAccounting {
  RentalBookingAccounting({SupabaseClient? client})
      : _client = client ?? SupabaseBootstrap.client;

  final SupabaseClient _client;

  String rentalPartyRevenueFingerprint(String companyId, String rentalId) =>
      'rental_party_revenue:$companyId:$rentalId';

  Future<({bool success, String? error})> ensurePartySubledgers(String contactId) async {
    if (contactId.isEmpty) {
      return (success: false, error: 'Contact id is required.');
    }
    try {
      final raw = await _client.rpc(
        'ensure_party_subledgers_for_contact',
        params: {'p_contact_id': contactId},
      );
      if (raw is! Map) {
        return (success: false, error: 'Invalid party subledger response.');
      }
      final res = Map<String, dynamic>.from(raw);
      if (res['success'] == true) return (success: true, error: null);
      return (success: false, error: res['error']?.toString() ?? 'Could not create party accounts.');
    } catch (e) {
      return (success: false, error: e.toString());
    }
  }

  Future<({String? arId, String? error})> resolveReceivablePostingAccountId({
    required String companyId,
    required String contactId,
  }) async {
    if (contactId.isEmpty) {
      return (arId: null, error: 'Customer contact id is required for AR posting.');
    }
    try {
      final raw = await _client.rpc(
        'ensure_party_subledgers_for_contact',
        params: {'p_contact_id': contactId},
      );
      if (raw is! Map) {
        return (arId: null, error: 'Invalid AR sub-account response.');
      }
      final res = Map<String, dynamic>.from(raw);
      final arId = res['ar_account_id']?.toString();
      if (arId == null || arId.isEmpty) {
        return (arId: null, error: 'Customer receivable account not found.');
      }
      final controlRow = await _client
          .from('accounts')
          .select('id, code')
          .eq('company_id', companyId)
          .eq('code', '1100')
          .eq('is_active', true)
          .maybeSingle();
      final controlId = controlRow?['id']?.toString();
      final accRow = await _client.from('accounts').select('code').eq('id', arId).maybeSingle();
      final code = accRow?['code']?.toString().trim() ?? '';
      if (arId == controlId || code == '1100') {
        return (
          arId: null,
          error: 'Named customer must post to AR sub-ledger (AR-CUS*), not control account 1100.',
        );
      }
      return (arId: arId, error: null);
    } catch (e) {
      return (arId: null, error: e.toString());
    }
  }

  Future<String?> _resolveRentalIncomeAccountId(String companyId) async {
    final rows = await _client
        .from('accounts')
        .select('id, name, code')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .eq('code', '4200');
    final list = (rows as List?) ?? [];
    for (final row in list) {
      final map = Map<String, dynamic>.from(row as Map);
      final name = map['name']?.toString().toLowerCase() ?? '';
      if (name.contains('rental') && (name.contains('income') || name.contains('revenue'))) {
        return map['id']?.toString();
      }
    }
    if (list.isNotEmpty) {
      return Map<String, dynamic>.from(list.first as Map)['id']?.toString();
    }
    return null;
  }

  Future<bool> _journalFingerprintExists(String companyId, String fingerprint) async {
    final row = await _client
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .eq('action_fingerprint', fingerprint)
        .maybeSingle();
    return row != null;
  }

  Future<String?> _nextJournalEntryNo(String companyId, String? branchId) async {
    try {
      final raw = await _client.rpc(
        'generate_document_number',
        params: {
          'p_company_id': companyId,
          'p_branch_id': branchId,
          'p_document_type': 'journal',
          'p_include_year': false,
        },
      );
      final no = raw?.toString().trim();
      if (no != null && no.isNotEmpty) return no;
    } catch (_) {
      // fallback below
    }
    return 'JE-${DateTime.now().millisecondsSinceEpoch}';
  }

  Future<({String? error})> _createJournalEntry({
    required String companyId,
    required String? branchId,
    required String entryDate,
    required String description,
    required String referenceType,
    required String referenceId,
    required String? actionFingerprint,
    required String? userId,
    required List<({String accountId, double debit, double credit, String? description})> lines,
  }) async {
    final totalDebit = lines.fold<double>(0, (s, l) => s + l.debit);
    final totalCredit = lines.fold<double>(0, (s, l) => s + l.credit);
    if ((totalDebit - totalCredit).abs() > 0.01) {
      return (error: 'Debit must equal Credit.');
    }
    final entryNo = await _nextJournalEntryNo(companyId, branchId);
    final entryRow = <String, dynamic>{
      'company_id': companyId,
      'entry_no': entryNo,
      'entry_date': entryDate.length >= 10 ? entryDate.substring(0, 10) : entryDate,
      'description': description,
      'reference_type': referenceType,
      'created_by': userId,
      'reference_id': referenceId,
    };
    if (branchId != null && branchId.isNotEmpty) {
      entryRow['branch_id'] = branchId;
    }
    if (actionFingerprint != null) {
      entryRow['action_fingerprint'] = actionFingerprint;
    }

    Map<String, dynamic> entry;
    try {
      entry = Map<String, dynamic>.from(
        await _client.from('journal_entries').insert(entryRow).select('id').single(),
      );
    } catch (e) {
      final msg = e.toString();
      if (msg.contains('action_fingerprint')) {
        entryRow.remove('action_fingerprint');
        entry = Map<String, dynamic>.from(
          await _client.from('journal_entries').insert(entryRow).select('id').single(),
        );
      } else {
        return (error: e.toString());
      }
    }

    final jeId = entry['id']?.toString();
    if (jeId == null) return (error: 'Failed to create journal entry.');

    for (final line in lines) {
      await _client.from('journal_entry_lines').insert({
        'journal_entry_id': jeId,
        'account_id': line.accountId,
        'debit': line.debit,
        'credit': line.credit,
        'description': line.description ?? description,
      });
    }
    return (error: null);
  }

  Future<({String? error})> postRentalPartyRevenueJournal({
    required String companyId,
    required String branchId,
    required String rentalId,
    required String customerId,
    required String customerName,
    required double rentalCharges,
    required String entryDate,
    required String? userId,
  }) async {
    if (rentalCharges <= 0) return (error: null);
    final fp = rentalPartyRevenueFingerprint(companyId, rentalId);
    if (await _journalFingerprintExists(companyId, fp)) return (error: null);

    final ar = await resolveReceivablePostingAccountId(companyId: companyId, contactId: customerId);
    if (ar.error != null || ar.arId == null) {
      return (error: ar.error ?? 'AR account not found.');
    }
    final incId = await _resolveRentalIncomeAccountId(companyId);
    if (incId == null) return (error: 'Rental Income account (4200) not found.');

    final desc = 'Rental charges — $customerName';
    return _createJournalEntry(
      companyId: companyId,
      branchId: branchId,
      entryDate: entryDate,
      description: desc,
      referenceType: 'rental',
      referenceId: rentalId,
      actionFingerprint: fp,
      userId: userId,
      lines: [
        (accountId: ar.arId!, debit: rentalCharges, credit: 0, description: desc),
        (accountId: incId, debit: 0, credit: rentalCharges, description: desc),
      ],
    );
  }

  Future<void> linkRentalPaymentJournalEntry(String rentalPaymentId, String journalEntryId) async {
    try {
      await _client
          .from('rental_payments')
          .update({'journal_entry_id': journalEntryId})
          .eq('id', rentalPaymentId);
    } catch (_) {
      // column may be missing on older DBs
    }
  }
}
