import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/app_data_table.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../core/widgets/money_text.dart';
import '../providers/reports_providers.dart';

class ExpenseReportScreen extends ConsumerWidget {
  const ExpenseReportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncRows = ref.watch(expenseReportProvider);

    return ModuleScaffold(
      title: 'Expense report',
      body: asyncRows.when(
        loading: () => const AppLoading(message: 'Loading expenses…'),
        error: (e, _) => AppErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(expenseReportProvider),
        ),
        data: (rows) {
          if (rows.isEmpty) {
            return const AppEmptyState(title: 'No expenses found');
          }
          final total = rows.fold<double>(0, (s, r) => s + r.amount);
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(expenseReportProvider),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(
                    'Total: ',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                MoneyText(total, bold: true),
                const SizedBox(height: 16),
                AppDataTable(
                  columns: const [
                    DataColumn(label: Text('EXP #')),
                    DataColumn(label: Text('Date')),
                    DataColumn(label: Text('Category')),
                    DataColumn(label: Text('Amount')),
                  ],
                  rows: rows
                      .map(
                        (r) => DataRow(
                          cells: [
                            DataCell(Text(r.expenseNo)),
                            DataCell(Text(r.expenseDate)),
                            DataCell(Text(r.categoryName)),
                            DataCell(MoneyText(r.amount)),
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
    );
  }
}
