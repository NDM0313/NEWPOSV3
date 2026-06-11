import '../../core/supabase/supabase_bootstrap.dart';

class JournalLineInput {
  const JournalLineInput({
    required this.accountId,
    required this.debit,
    required this.credit,
    this.description,
  });

  final String accountId;
  final double debit;
  final double credit;
  final String? description;
}

class JournalWriteRepository {
  final _client = SupabaseBootstrap.client;

  Future<({String? id, String? entryNo, String? error})> createJournalEntry({
    required String companyId,
    required String branchId,
    required String entryDate,
    required String description,
    required String referenceType,
    required List<JournalLineInput> lines,
    String? referenceId,
    String? userId,
  }) async {
    final totalDebit = lines.fold<double>(0, (s, l) => s + l.debit);
    final totalCredit = lines.fold<double>(0, (s, l) => s + l.credit);
    if ((totalDebit - totalCredit).abs() > 0.01) {
      return (id: null, entryNo: null, error: 'Debit must equal Credit.');
    }

    try {
      final entryNo = await _client.rpc(
        'get_next_document_number',
        params: {
          'p_company_id': companyId,
          'p_branch_id': branchId,
          'p_doc_type': 'journal',
        },
      );

      final entryRow = <String, dynamic>{
        'company_id': companyId,
        'entry_no': entryNo?.toString() ?? 'JE-LOCAL',
        'entry_date': entryDate,
        'description': description,
        'reference_type': referenceType,
        'created_by': userId,
        'branch_id': branchId,
        'reference_id': ?referenceId,
      };

      final entryResult = await _client
          .from('journal_entries')
          .insert(entryRow)
          .select('id, entry_no')
          .single();

      final entryId = entryResult['id']?.toString();
      if (entryId == null) {
        return (id: null, entryNo: null, error: 'Failed to create entry.');
      }

      for (final line in lines) {
        await _client.from('journal_entry_lines').insert({
          'journal_entry_id': entryId,
          'account_id': line.accountId,
          'debit': line.debit,
          'credit': line.credit,
          'description': line.description ?? description,
        });
      }

      return (
        id: entryId,
        entryNo: entryResult['entry_no']?.toString(),
        error: null,
      );
    } catch (e) {
      return (id: null, entryNo: null, error: e.toString());
    }
  }
}
