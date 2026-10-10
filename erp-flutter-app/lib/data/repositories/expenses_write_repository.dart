import '../../core/supabase/supabase_bootstrap.dart';
import '../../core/utils/branch_id.dart';
import '../../core/utils/local_date.dart';

class ExpensesWriteRepository {
  final _client = SupabaseBootstrap.client;

  Future<({String? expenseId, String? expenseNo, String? error})> createExpense({
    required String companyId,
    required String branchId,
    required String createdBy,
    required String category,
    required String description,
    required double amount,
  }) async {
    if (amount <= 0) {
      return (expenseId: null, expenseNo: null, error: 'Amount must be greater than zero.');
    }

    final branch = safeRpcBranchId(branchId);
    if (branch == null) {
      return (
        expenseId: null,
        expenseNo: null,
        error: 'Select a valid branch before creating an expense.',
      );
    }

    final cat = category.trim().isEmpty ? 'General' : category.trim();
    final desc = description.trim().isEmpty ? cat : description.trim();

    try {
      String? accountId;
      final accountRow = await _client
          .from('accounts')
          .select('id')
          .eq('company_id', companyId)
          .inFilter('type', ['cash', 'bank'])
          .limit(1)
          .maybeSingle();
      accountId = accountRow?['id']?.toString();

      final expensePayload = <String, dynamic>{
        'expense_date': localTodayIso(),
        'category': cat,
        'description': desc,
        'amount': amount,
        'payment_method': 'cash',
      };
      if (accountId != null) {
        expensePayload['payment_account_id'] = accountId;
      }

      final raw = await _client.rpc(
        'create_expense_document',
        params: {
          'p_company_id': companyId,
          'p_branch_id': branch,
          'p_expense': expensePayload,
          'p_created_by': createdBy,
        },
      );

      if (raw is! Map) {
        return (expenseId: null, expenseNo: null, error: 'Invalid expense RPC response.');
      }

      final res = Map<String, dynamic>.from(raw);
      if (res['success'] != true || res['expense_id'] == null) {
        return (
          expenseId: null,
          expenseNo: null,
          error: res['error']?.toString() ?? 'Failed to create expense.',
        );
      }

      final expenseId = res['expense_id'].toString();
      final expenseNo = res['expense_no']?.toString();

      try {
        await _client.rpc(
          'record_expense_with_accounting',
          params: {'p_expense_id': expenseId},
        );
      } catch (_) {
        // Soft-warn parity with mobile
      }

      return (expenseId: expenseId, expenseNo: expenseNo, error: null);
    } catch (e) {
      return (expenseId: null, expenseNo: null, error: e.toString());
    }
  }
}
