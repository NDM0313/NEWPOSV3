import '../../core/supabase/supabase_bootstrap.dart';
import '../../core/utils/branch_id.dart';
import '../../core/utils/sale_document_no.dart';

class StudioSaleRow {
  const StudioSaleRow({
    required this.id,
    required this.documentNo,
    required this.customerName,
    required this.total,
    required this.paid,
    required this.due,
    required this.status,
    required this.date,
  });

  final String id;
  final String documentNo;
  final String customerName;
  final double total;
  final double paid;
  final double due;
  final String status;
  final String date;
}

class StudioReadRepository {
  final _client = SupabaseBootstrap.client;

  Future<({List<StudioSaleRow> sales, String? error})> getStudioSales({
    required String companyId,
    String? branchId,
    List<String>? accessibleBranchIds,
  }) async {
    try {
      var query = _client
          .from('sales')
          .select(
            'id, invoice_no, order_no, invoice_date, customer_name, total, paid_amount, due_amount, payment_status, status, branch_id, is_studio',
          )
          .eq('company_id', companyId)
          .eq('is_studio', true);

      final branch = safeRpcBranchId(branchId);
      if (branch != null) {
        query = query.eq('branch_id', branch);
      } else if (accessibleBranchIds != null && accessibleBranchIds.isNotEmpty) {
        query = query.inFilter('branch_id', accessibleBranchIds);
      }

      final data = await query
          .order('invoice_date', ascending: false)
          .limit(100);

      final sales = (data as List).map((row) {
        final map = Map<String, dynamic>.from(row as Map);
        final dateRaw = map['invoice_date']?.toString() ?? '';
        return StudioSaleRow(
          id: map['id'] as String,
          documentNo: readSaleDocumentNo(map),
          customerName: map['customer_name'] as String? ?? '—',
          total: _num(map['total']),
          paid: _num(map['paid_amount']),
          due: _num(map['due_amount']),
          status: map['status'] as String? ?? '—',
          date: dateRaw.length >= 10 ? dateRaw.substring(0, 10) : dateRaw,
        );
      }).toList();

      return (sales: sales, error: null);
    } catch (e) {
      return (sales: <StudioSaleRow>[], error: e.toString());
    }
  }

  double _num(dynamic v) =>
      v == null ? 0 : (num.tryParse(v.toString()) ?? 0).toDouble();
}
