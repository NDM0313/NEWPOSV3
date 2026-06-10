import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/permissions/contact_balance_visibility.dart';
import '../../../core/session/session_scope.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../data/models/contact.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../providers/contacts_providers.dart';

class ContactDetailScreen extends ConsumerWidget {
  const ContactDetailScreen({super.key, required this.contactId});

  final String contactId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authSessionProvider);
    final scope = SessionScope.from(session);
    final asyncContact = ref.watch(contactDetailProvider(contactId));

    return ModuleScaffold(
      title: 'Contact',
      body: asyncContact.when(
        loading: () => const AppLoading(message: 'Loading contact…'),
        error: (e, _) => AppErrorState(
          message: e.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.invalidate(contactDetailProvider(contactId)),
        ),
        data: (contact) {
          if (contact == null) {
            return const AppEmptyState(
              title: 'Contact not found',
              subtitle: 'It may have been removed or you lack access.',
            );
          }

          final showBalance = scope != null &&
              canShowContactBalance(scope.permissions, contact);

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                contact.name,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              if (contact.isSystemGenerated)
                const Padding(
                  padding: EdgeInsets.only(top: 4),
                  child: Text(
                    'Walk-in / system contact',
                    style: TextStyle(color: AppColors.warning, fontSize: 13),
                  ),
                ),
              const SizedBox(height: 16),
              _DetailSection(
                children: [
                  _DetailRow(label: 'Type', value: contact.type ?? '—'),
                  if (contact.code != null && contact.code!.isNotEmpty)
                    _DetailRow(label: 'Code', value: contact.code!),
                  _DetailRow(
                    label: 'Status',
                    value: contact.status == ContactStatus.active
                        ? 'Active'
                        : 'Inactive',
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _DetailSection(
                children: [
                  if (contact.displayPhone.isNotEmpty)
                    _DetailRow(label: 'Phone', value: contact.displayPhone),
                  if (contact.email != null && contact.email!.isNotEmpty)
                    _DetailRow(label: 'Email', value: contact.email!),
                  if (contact.city != null && contact.city!.isNotEmpty)
                    _DetailRow(label: 'City', value: contact.city!),
                  if (contact.address != null && contact.address!.isNotEmpty)
                    _DetailRow(label: 'Address', value: contact.address!),
                ],
              ),
              if (showBalance) ...[
                const SizedBox(height: 12),
                _DetailSection(
                  children: [
                    _DetailRow(
                      label: 'Balance',
                      value: formatMoney(contact.balance),
                      valueColor: contact.balance >= 0
                          ? AppColors.success
                          : AppColors.error,
                    ),
                    if (contact.creditLimit != null)
                      _DetailRow(
                        label: 'Credit limit',
                        value: formatMoney(contact.creditLimit!),
                      ),
                  ],
                ),
              ],
              const SizedBox(height: 24),
              const Text(
                'Read-only view — editing arrives in a later phase.',
                style: TextStyle(color: AppColors.muted, fontSize: 12),
                textAlign: TextAlign.center,
              ),
            ],
          );
        },
      ),
    );
  }
}

class _DetailSection extends StatelessWidget {
  const _DetailSection({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(children: children),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label, style: const TextStyle(color: AppColors.muted)),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                color: valueColor ?? AppColors.textPrimary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
