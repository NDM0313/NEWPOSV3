import '../../core/supabase/supabase_bootstrap.dart';
import '../../core/utils/branch_id.dart';

class PartyLedgerLine {
  const PartyLedgerLine({
    required this.id,
    required this.date,
    required this.description,
    required this.reference,
    required this.debit,
    required this.credit,
    required this.runningBalance,
  });

  final String id;
  final String date;
  final String description;
  final String reference;
  final double debit;
  final double credit;
  final double runningBalance;
}

class PartyLedgerRepository {
  final _client = SupabaseBootstrap.client;

  Future<
      ({
        double openingBalance,
        List<PartyLedgerLine> lines,
        String? error,
      })> getLedgerForContact({
    required String companyId,
    required String contactId,
    required String contactType,
    String? branchId,
  }) async {
    final branch = safeRpcBranchId(branchId);
    final type = contactType.toLowerCase();
    final isSupplierLedger = type == 'supplier';
    final rpcName = isSupplierLedger
        ? 'get_supplier_ap_gl_ledger_for_contact'
        : 'get_customer_ar_gl_ledger_for_contact';

    final params = <String, dynamic>{
      'p_company_id': companyId,
      'p_branch_id': branch,
      'p_start_date': null,
      'p_end_date': null,
    };
    if (isSupplierLedger) {
      params['p_supplier_id'] = contactId;
    } else {
      params['p_customer_id'] = contactId;
    }

    try {
      final raw = await _client.rpc(rpcName, params: params);

      if (raw is! Map) {
        return (openingBalance: 0.0, lines: <PartyLedgerLine>[], error: 'Invalid ledger response.');
      }

      final payload = Map<String, dynamic>.from(raw);
      final opening = _num(payload['period_opening_balance']);
      final rows = payload['rows'];
      if (rows is! List) {
        return (openingBalance: opening, lines: <PartyLedgerLine>[], error: null);
      }

      final lines = <PartyLedgerLine>[];
      for (var i = 0; i < rows.length; i++) {
        final r = Map<String, dynamic>.from(rows[i] as Map);
        final jelId = r['journal_entry_line_id'] ?? r['jel_id'];
        final jeId = r['journal_entry_id'] ?? r['je_id'];
        final id = jelId != null && jelId.toString().trim().isNotEmpty
            ? jelId.toString()
            : 'rpc-${jeId ?? 'line'}-$i';
        final entryNo = r['entry_no']?.toString() ?? '';
        final reference = entryNo.isNotEmpty
            ? entryNo
            : (jeId != null && jeId.toString().length >= 8
                ? jeId.toString().substring(0, 8)
                : '—');

        lines.add(
          PartyLedgerLine(
            id: id,
            date: (r['entry_date']?.toString() ?? '').length >= 10
                ? r['entry_date'].toString().substring(0, 10)
                : r['entry_date']?.toString() ?? '',
            description: r['description']?.toString() ?? '—',
            reference: reference,
            debit: _num(r['debit']),
            credit: _num(r['credit']),
            runningBalance: _num(r['running_balance']),
          ),
        );
      }

      return (openingBalance: opening, lines: lines, error: null);
    } catch (e) {
      return (openingBalance: 0.0, lines: <PartyLedgerLine>[], error: e.toString());
    }
  }

  double _num(dynamic v) =>
      v == null ? 0 : (num.tryParse(v.toString()) ?? 0).toDouble();
}
