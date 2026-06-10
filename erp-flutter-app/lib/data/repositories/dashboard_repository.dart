import '../../core/supabase/supabase_bootstrap.dart';
import '../../core/utils/branch_id.dart';
import '../models/dashboard_metrics.dart';

class DashboardRepository {
  final _client = SupabaseBootstrap.client;

  String _todayIso() {
    final now = DateTime.now();
    return '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  Future<({DashboardMetrics? metrics, List<LowStockItem> lowStock, String? error})>
      getDashboardMetrics({
    required String companyId,
    String? branchId,
    bool useWorkerScope = false,
    String? authUserId,
    String? profileId,
  }) async {
    if (useWorkerScope && authUserId != null) {
      return _workerScopedMetrics(
        companyId: companyId,
        branchId: branchId,
        authUserId: authUserId,
        profileId: profileId,
      );
    }

    try {
      final raw = await _client.rpc(
        'get_dashboard_metrics',
        params: {
          'p_company_id': companyId,
          'p_branch_id': safeRpcBranchId(branchId),
          'p_start_date': null,
          'p_end_date': null,
        },
      );

      if (raw is! Map) {
        return (
          metrics: null,
          lowStock: <LowStockItem>[],
          error: 'Invalid dashboard response.',
        );
      }

      final metricsRaw = raw['metrics'];
      final m = metricsRaw is Map ? Map<String, dynamic>.from(metricsRaw) : <String, dynamic>{};

      final lowStock = <LowStockItem>[];
      final lowRaw = raw['low_stock_items'];
      if (lowRaw is List) {
        for (final item in lowRaw) {
          if (item is! Map) continue;
          final map = Map<String, dynamic>.from(item);
          lowStock.add(
            LowStockItem(
              id: map['id']?.toString() ?? '',
              name: map['name'] as String? ?? '—',
              currentStock: _num(map['current_stock']),
              minStock: _num(map['min_stock']),
              sku: map['sku'] as String?,
            ),
          );
        }
      }

      return (
        metrics: DashboardMetrics(
          todaySales: _num(m['today_sales']),
          todayProfit: _num(m['today_profit']),
          monthlyRevenue: _num(m['monthly_revenue']),
          monthlyExpenses: _num(m['monthly_expenses']),
          monthlyProfit: _num(m['monthly_profit']),
          cashBalance: _num(m['cash_balance']),
          bankBalance: _num(m['bank_balance']),
          receivables: _num(m['receivables']),
          payables: _num(m['payables']),
          errorMessage: m['error']?.toString(),
        ),
        lowStock: lowStock,
        error: raw['error']?.toString(),
      );
    } catch (e) {
      if (useWorkerScope && authUserId != null) {
        return _workerScopedMetrics(
          companyId: companyId,
          branchId: branchId,
          authUserId: authUserId,
          profileId: profileId,
        );
      }
      return (
        metrics: null,
        lowStock: <LowStockItem>[],
        error: e.toString(),
      );
    }
  }

  Future<({DashboardMetrics? metrics, List<LowStockItem> lowStock, String? error})>
      _workerScopedMetrics({
    required String companyId,
    String? branchId,
    required String authUserId,
    String? profileId,
  }) async {
    final today = _todayIso();
    try {
      var query = _client
          .from('sales')
          .select('id, total, studio_charges, invoice_date, status, created_by, branch_id')
          .eq('company_id', companyId)
          .eq('status', 'final')
          .gte('invoice_date', today)
          .lte('invoice_date', today);

      final branch = safeRpcBranchId(branchId);
      if (branch != null) {
        query = query.eq('branch_id', branch);
      }

      final userIds = <String>[authUserId];
      if (profileId != null && profileId.isNotEmpty && profileId != authUserId) {
        userIds.add(profileId);
      }
      if (userIds.length == 1) {
        query = query.eq('created_by', userIds.first);
      } else if (userIds.length > 1) {
        query = query.or(
          'created_by.eq.${userIds[0]},created_by.eq.${userIds[1]}',
        );
      }

      final sales = await query;
      double revenue = 0;
      for (final row in sales as List) {
        if (row is! Map) continue;
        final map = Map<String, dynamic>.from(row);
        revenue += _num(map['total']) + _num(map['studio_charges']);
      }

      return (
        metrics: DashboardMetrics(
          todaySales: revenue,
          workerRevenue: revenue,
          workerProfit: revenue,
          ordersCount: (sales as List).length,
          isWorkerScoped: true,
        ),
        lowStock: <LowStockItem>[],
        error: null,
      );
    } catch (e) {
      return (
        metrics: null,
        lowStock: <LowStockItem>[],
        error: e.toString(),
      );
    }
  }

  double _num(dynamic v) =>
      v == null ? 0 : (num.tryParse(v.toString()) ?? 0).toDouble();
}
