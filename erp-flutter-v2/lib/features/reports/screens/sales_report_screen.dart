import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_data_table.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../core/widgets/metric_card.dart';
import '../../../core/widgets/money_text.dart';
import '../providers/reports_providers.dart';

class SalesReportScreen extends ConsumerWidget {
  const SalesReportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncRows = ref.watch(salesReportProvider);
    final asyncSummary = ref.watch(reportsSummaryProvider);
    final days = ref.watch(reportsPeriodDaysProvider);

    return ModuleScaffold(
      title: 'Sales report',
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: asyncSummary.when(
                    loading: () => const LinearProgressIndicator(),
                    error: (_, _) => const SizedBox.shrink(),
                    data: (s) => Row(
                      children: [
                        Expanded(
                          child: MetricCard(
                            label: 'Sales total',
                            value: formatMoney(s.salesTotal),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: MetricCard(
                            label: 'Invoices',
                            value: '${s.saleCount}',
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: SegmentedButton<int>(
              segments: const [
                ButtonSegment(value: 7, label: Text('7d')),
                ButtonSegment(value: 30, label: Text('30d')),
                ButtonSegment(value: 90, label: Text('90d')),
              ],
              selected: {days},
              onSelectionChanged: (s) =>
                  ref.read(reportsPeriodDaysProvider.notifier).state = s.first,
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: asyncRows.when(
              loading: () => const AppLoading(message: 'Loading sales…'),
              error: (e, _) => AppErrorState(
                message: e.toString(),
                onRetry: () => ref.invalidate(salesReportProvider),
              ),
              data: (rows) {
                if (rows.isEmpty) {
                  return const AppEmptyState(title: 'No sales in period');
                }
                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(salesReportProvider),
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      AppDataTable(
                        columns: const [
                          DataColumn(label: Text('Invoice')),
                          DataColumn(label: Text('Date')),
                          DataColumn(label: Text('Customer')),
                          DataColumn(label: Text('Total')),
                          DataColumn(label: Text('Due')),
                          DataColumn(label: Text('Status')),
                        ],
                        rows: rows
                            .map(
                              (r) => DataRow(
                                cells: [
                                  DataCell(Text(r.invoiceNo)),
                                  DataCell(Text(r.invoiceDate)),
                                  DataCell(Text(r.customerName)),
                                  DataCell(MoneyText(r.total)),
                                  DataCell(MoneyText(r.dueAmount)),
                                  DataCell(Text(r.status)),
                                ],
                              ),
                            )
                            .toList(),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
