import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/widgets/module_scaffold.dart';

class ReportsHubScreen extends StatelessWidget {
  const ReportsHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ModuleScaffold(
      title: 'Reports',
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Operational reports',
            style: TextStyle(color: AppColors.muted, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),
          _ReportTile(
            title: 'Sales report',
            subtitle: 'Invoices, totals, paid/due',
            icon: Icons.shopping_cart_outlined,
            onTap: () => context.push('/reports/sales'),
          ),
          _ReportTile(
            title: 'Expense report',
            subtitle: 'Business expenses by category',
            icon: Icons.receipt_long_outlined,
            onTap: () => context.push('/reports/expenses'),
          ),
          _ReportTile(
            title: 'Account ledger',
            subtitle: 'Chart of accounts balances',
            icon: Icons.account_balance_outlined,
            onTap: () => context.push('/accounts'),
          ),
          _ReportTile(
            title: 'Journal entries',
            subtitle: 'Day book / GL activity',
            icon: Icons.menu_book_outlined,
            onTap: () => context.push('/ledger'),
          ),
          _ReportTile(
            title: 'Dashboard metrics',
            subtitle: 'KPI summary',
            icon: Icons.dashboard_outlined,
            onTap: () => context.push('/dashboard'),
          ),
        ],
      ),
    );
  }
}

class _ReportTile extends StatelessWidget {
  const _ReportTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(icon, color: AppColors.primary),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
