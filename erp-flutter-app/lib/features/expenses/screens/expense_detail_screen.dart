import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/detail_section.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../providers/expenses_providers.dart';

class ExpenseDetailScreen extends ConsumerWidget {
  const ExpenseDetailScreen({super.key, required this.expenseId});

  final String expenseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncExpense = ref.watch(expenseDetailProvider(expenseId));

    return ModuleScaffold(
      title: 'Expense',
      body: asyncExpense.when(
        loading: () => const AppLoading(message: 'Loading expense…'),
        error: (e, _) => AppErrorState(
          message: e.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.invalidate(expenseDetailProvider(expenseId)),
        ),
        data: (expense) {
          if (expense == null) {
            return const AppEmptyState(
              title: 'Expense not found',
              subtitle: 'It may have been removed or you lack access.',
            );
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                expense.expenseNo,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              DetailSection(
                children: [
                  DetailRow(label: 'Date', value: expense.date),
                  DetailRow(label: 'Category', value: expense.category),
                  DetailRow(label: 'Status', value: expense.status),
                  DetailRow(label: 'Payment', value: expense.paymentMethod),
                  if (expense.vendorName != null)
                    DetailRow(label: 'Vendor', value: expense.vendorName!),
                  DetailRow(label: 'Amount', value: formatMoney(expense.amount)),
                ],
              ),
              const SizedBox(height: 12),
              DetailSection(
                children: [
                  DetailRow(label: 'Description', value: expense.description),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}
