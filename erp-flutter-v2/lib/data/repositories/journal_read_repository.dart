import '../../core/supabase/supabase_bootstrap.dart';

class JournalEntryRow {
  const JournalEntryRow({
    required this.id,
    required this.entryNo,
    required this.date,
    required this.description,
    required this.referenceType,
    required this.totalDebit,
    required this.totalCredit,
  });

  final String id;
  final String entryNo;
  final String date;
  final String description;
  final String referenceType;
  final double totalDebit;
  final double totalCredit;
}

class JournalReadRepository {
  final _client = SupabaseBootstrap.client;

  Future<({List<JournalEntryRow> entries, String? error})> getRecentEntries({
    required String companyId,
    int limit = 50,
  }) async {
    try {
      final data = await _client
          .from('journal_entries')
          .select('id, entry_no, entry_date, description, reference_type, total_debit, total_credit')
          .eq('company_id', companyId)
          .order('entry_date', ascending: false)
          .limit(limit);

      final entries = (data as List).map((row) {
        final map = Map<String, dynamic>.from(row as Map);
        final dateRaw = map['entry_date']?.toString() ?? '';
        return JournalEntryRow(
          id: map['id'] as String,
          entryNo: map['entry_no']?.toString() ?? '—',
          date: dateRaw.length >= 10 ? dateRaw.substring(0, 10) : dateRaw,
          description: map['description']?.toString() ?? '—',
          referenceType: map['reference_type']?.toString() ?? '—',
          totalDebit: _num(map['total_debit']),
          totalCredit: _num(map['total_credit']),
        );
      }).toList();

      return (entries: entries, error: null);
    } catch (e) {
      return (entries: <JournalEntryRow>[], error: e.toString());
    }
  }

  double _num(dynamic v) =>
      v == null ? 0 : (num.tryParse(v.toString()) ?? 0).toDouble();
}
