import '../../core/supabase/supabase_bootstrap.dart';
import '../../core/utils/branch_id.dart';

class SalesReportRow {
  const SalesReportRow({
    required this.id,
    required this.invoiceNo,
    required this.customerName,
    required this.invoiceDate,
    required this.total,
    required this.paidAmount,
    required this.dueAmount,
    required this.status,
  });

  final String id;
  final String invoiceNo;
  final String customerName;
  final String invoiceDate;
  final double total;
  final double paidAmount;
  final double dueAmount;
  final String status;
}

class ExpenseReportRow {
  const ExpenseReportRow({
    required this.id,
    required this.expenseNo,
    required this.expenseDate,
    required this.categoryName,
    required this.amount,
  });

  final String id;
  final String expenseNo;
  final String expenseDate;
  final String categoryName;
  final double amount;
}

/// Read-only operational reports (mirrors erp-mobile-app reports API subset).
class ReportsRepository {
  final _client = SupabaseBootstrap.client;

  Future<List<SalesReportRow>> fetchSalesReport({
    required String companyId,
    String? branchId,
    DateTime? from,
    DateTime? to,
    int limit = 200,
  }) async {
    var query = _client
        .from('sales')
        .select(
          'id, invoice_no, customer_name, invoice_date, total, paid_amount, due_amount, status',
        )
        .eq('company_id', companyId)
        .neq('status', 'cancelled')
        .order('invoice_date', ascending: false)
        .limit(limit);

    final effectiveBranch = branchId != null ? safeRpcBranchId(branchId) : null;
    if (effectiveBranch != null) {
      query = query.eq('branch_id', effectiveBranch);
    }
    if (from != null) {
      query = query.gte('invoice_date', _isoDate(from));
    }
    if (to != null) {
      query = query.lte('invoice_date', _isoDate(to));
    }

    final rows = List<Map<String, dynamic>>.from(await query as List);
    return rows.map((r) {
      return SalesReportRow(
        id: r['id'].toString(),
        invoiceNo: r['invoice_no']?.toString() ?? '—',
        customerName: r['customer_name']?.toString() ?? '—',
        invoiceDate: r['invoice_date']?.toString() ?? '',
        total: (r['total'] as num?)?.toDouble() ?? 0,
        paidAmount: (r['paid_amount'] as num?)?.toDouble() ?? 0,
        dueAmount: (r['due_amount'] as num?)?.toDouble() ?? 0,
        status: r['status']?.toString() ?? '',
      );
    }).toList();
  }

  Future<List<ExpenseReportRow>> fetchExpenseReport({
    required String companyId,
    String? branchId,
    int limit = 200,
  }) async {
    var query = _client
        .from('expenses')
        .select('id, expense_no, expense_date, amount, category')
        .eq('company_id', companyId)
        .order('expense_date', ascending: false)
        .limit(limit);

    final effectiveBranch = branchId != null ? safeRpcBranchId(branchId) : null;
    if (effectiveBranch != null) {
      query = query.eq('branch_id', effectiveBranch);
    }

    final rows = List<Map<String, dynamic>>.from(await query as List);
    return rows.map((r) {
      return ExpenseReportRow(
        id: r['id'].toString(),
        expenseNo: r['expense_no']?.toString() ?? '—',
        expenseDate: r['expense_date']?.toString() ?? '',
        categoryName: r['category']?.toString() ?? '—',
        amount: (r['amount'] as num?)?.toDouble() ?? 0,
      );
    }).toList();
  }

  Future<({double salesTotal, double expenseTotal, int saleCount})> fetchPeriodSummary({
    required String companyId,
    String? branchId,
    DateTime? from,
    DateTime? to,
  }) async {
    final sales = await fetchSalesReport(
      companyId: companyId,
      branchId: branchId,
      from: from,
      to: to,
    );
    final expenses = await fetchExpenseReport(
      companyId: companyId,
      branchId: branchId,
    );

    final salesTotal = sales.fold<double>(0, (s, r) => s + r.total);
    final expenseTotal = expenses.fold<double>(0, (s, r) => s + r.amount);
    return (salesTotal: salesTotal, expenseTotal: expenseTotal, saleCount: sales.length);
  }

  String _isoDate(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}
