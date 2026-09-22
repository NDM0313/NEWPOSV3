import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/metric_card.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../data/models/dashboard_metrics.dart';
import '../providers/dashboard_providers.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(dashboardDataProvider);

    return ModuleScaffold(
      title: 'Dashboard',
      body: asyncData.when(
        loading: () => const AppLoading(message: 'Loading dashboard…'),
        error: (e, _) => AppErrorState(
          message: e.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.invalidate(dashboardDataProvider),
        ),
        data: (data) => _DashboardBody(data: data),
      ),
    );
  }
}

class _DashboardBody extends StatelessWidget {
  const _DashboardBody({required this.data});

  final DashboardData data;

  @override
  Widget build(BuildContext context) {
    final metrics = data.metrics;
    if (metrics == null) {
      return AppErrorState(
        message: data.error ?? 'Dashboard unavailable.',
      );
    }

    if (metrics.errorMessage != null && metrics.errorMessage!.isNotEmpty) {
      return AppErrorState(message: metrics.errorMessage!);
    }

    final cards = <Widget>[];

    if (metrics.isWorkerScoped || !data.showFinancialMetrics) {
      cards.addAll([
        MetricCard(
          label: 'My sales today',
          value: formatMoney(metrics.workerRevenue > 0
              ? metrics.workerRevenue
              : metrics.todaySales),
          icon: Icons.point_of_sale,
          color: AppColors.primary,
        ),
        MetricCard(
          label: 'Orders today',
          value: metrics.ordersCount.toString(),
          icon: Icons.receipt_long,
          color: AppColors.success,
        ),
      ]);
    } else {
      cards.addAll([
        MetricCard(
          label: 'Sales today',
          value: formatMoney(metrics.todaySales),
          icon: Icons.trending_up,
          color: AppColors.primary,
        ),
        MetricCard(
          label: 'Profit today',
          value: formatMoney(metrics.todayProfit),
          icon: Icons.show_chart,
          color: AppColors.success,
        ),
        MetricCard(
          label: 'Monthly revenue',
          value: formatMoney(metrics.monthlyRevenue),
          icon: Icons.calendar_month,
          color: AppColors.primary,
        ),
        MetricCard(
          label: 'Monthly expenses',
          value: formatMoney(metrics.monthlyExpenses),
          icon: Icons.money_off,
          color: AppColors.warning,
        ),
        MetricCard(
          label: 'Monthly profit',
          value: formatMoney(metrics.monthlyProfit),
          icon: Icons.account_balance,
          color: AppColors.success,
        ),
        MetricCard(
          label: 'Cash balance',
          value: formatMoney(metrics.cashBalance),
          icon: Icons.payments,
          color: AppColors.warning,
        ),
        MetricCard(
          label: 'Bank balance',
          value: formatMoney(metrics.bankBalance),
          icon: Icons.account_balance_wallet,
          color: AppColors.primary,
        ),
        MetricCard(
          label: 'Receivables',
          value: formatMoney(metrics.receivables),
          icon: Icons.arrow_downward,
          color: AppColors.success,
        ),
        MetricCard(
          label: 'Payables',
          value: formatMoney(metrics.payables),
          icon: Icons.arrow_upward,
          color: AppColors.error,
        ),
      ]);
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (data.error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              data.error!,
              style: const TextStyle(color: AppColors.warning, fontSize: 12),
            ),
          ),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.35,
          children: cards,
        ),
        if (data.showFinancialMetrics && data.lowStock.isNotEmpty) ...[
          const SizedBox(height: 24),
          const Text(
            'LOW STOCK',
            style: TextStyle(
              color: AppColors.muted,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 8),
          ...data.lowStock.map((item) => _LowStockTile(item: item)),
        ],
        const SizedBox(height: 24),
        const Text(
          'Read-only dashboard — write actions arrive in later phases.',
          style: TextStyle(color: AppColors.muted, fontSize: 12),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

class _LowStockTile extends StatelessWidget {
  const _LowStockTile({required this.item});

  final LowStockItem item;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (item.sku != null)
                  Text(
                    item.sku!,
                    style: const TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
              ],
            ),
          ),
          Text(
            '${item.currentStock} / ${item.minStock}',
            style: const TextStyle(color: AppColors.warning, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
