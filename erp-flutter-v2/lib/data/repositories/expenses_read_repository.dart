import '../../core/supabase/supabase_bootstrap.dart';
import '../../core/utils/branch_id.dart';
import '../models/expense.dart';

const _listSelect =
    'id, expense_no, expense_date, category, description, amount, payment_method, status, created_by, paid_to_user_id, branch_id, created_at, vendor_name';

const _detailSelect =
    'id, expense_no, expense_date, category, description, amount, payment_method, status, vendor_name, receipt_url, branch_id';

class ExpensesReadRepository {
  final _client = SupabaseBootstrap.client;

  Future<({List<ExpenseListItem> expenses, String? error})> getExpenses({
    required String companyId,
    String? branchId,
    List<String>? accessibleBranchIds,
  }) async {
    try {
      var query = _client
          .from('expenses')
          .select(_listSelect)
          .eq('company_id', companyId);

      query = _applyBranchFilter(query, branchId, accessibleBranchIds);

      final data = await query
          .order('expense_date', ascending: false)
          .order('created_at', ascending: false)
          .limit(100);

      final expenses = (data as List).map((row) {
        final map = Map<String, dynamic>.from(row as Map);
        return _mapListItem(map);
      }).toList();

      return (expenses: expenses, error: null);
    } catch (e) {
      return (expenses: <ExpenseListItem>[], error: e.toString());
    }
  }

  Future<({ExpenseDetail? expense, String? error})> getExpenseById({
    required String companyId,
    required String expenseId,
  }) async {
    try {
      final row = await _client
          .from('expenses')
          .select(_detailSelect)
          .eq('company_id', companyId)
          .eq('id', expenseId)
          .maybeSingle();

      if (row == null) {
        return (
          expense: null,
          error: 'Expense not found or access denied.',
        );
      }

      return (expense: _mapDetail(Map<String, dynamic>.from(row)), error: null);
    } catch (e) {
      return (expense: null, error: e.toString());
    }
  }

  dynamic _applyBranchFilter(
    dynamic query,
    String? branchId,
    List<String>? accessibleBranchIds,
  ) {
    final branch = safeRpcBranchId(branchId);
    if (branch != null) {
      return query.eq('branch_id', branch);
    }
    if (accessibleBranchIds != null && accessibleBranchIds.isNotEmpty) {
      return query.inFilter('branch_id', accessibleBranchIds);
    }
    return query;
  }

  ExpenseListItem _mapListItem(Map<String, dynamic> map) {
    final dateRaw = map['expense_date']?.toString() ?? '';
    final no = map['expense_no']?.toString();
    return ExpenseListItem(
      id: map['id'] as String,
      expenseNo: (no != null && no.isNotEmpty) ? no : map['id'].toString().substring(0, 8),
      date: dateRaw.length >= 10 ? dateRaw.substring(0, 10) : dateRaw,
      category: map['category'] as String? ?? '—',
      description: map['description'] as String? ?? '—',
      amount: _num(map['amount']),
      status: map['status'] as String? ?? '—',
      paymentMethod: map['payment_method'] as String? ?? '—',
      vendorName: map['vendor_name'] as String?,
    );
  }

  ExpenseDetail _mapDetail(Map<String, dynamic> map) {
    final dateRaw = map['expense_date']?.toString() ?? '';
    final no = map['expense_no']?.toString();
    return ExpenseDetail(
      id: map['id'] as String,
      expenseNo: (no != null && no.isNotEmpty) ? no : '—',
      date: dateRaw.length >= 10 ? dateRaw.substring(0, 10) : dateRaw,
      category: map['category'] as String? ?? '—',
      description: map['description'] as String? ?? '—',
      amount: _num(map['amount']),
      status: map['status'] as String? ?? '—',
      paymentMethod: map['payment_method'] as String? ?? '—',
      vendorName: map['vendor_name'] as String?,
      receiptUrl: map['receipt_url'] as String?,
    );
  }

  double _num(dynamic v) =>
      v == null ? 0 : (num.tryParse(v.toString()) ?? 0).toDouble();
}
