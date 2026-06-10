import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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

class ContactsListScreen extends ConsumerStatefulWidget {
  const ContactsListScreen({super.key});

  @override
  ConsumerState<ContactsListScreen> createState() => _ContactsListScreenState();
}

class _ContactsListScreenState extends ConsumerState<ContactsListScreen> {
  ContactRoleFilter _filter = ContactRoleFilter.all;
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Contact> _filterContacts(List<Contact> contacts) {
    final q = _searchQuery.trim().toLowerCase();
    if (q.isEmpty) return contacts;
    return contacts.where((c) {
      return c.name.toLowerCase().contains(q) ||
          c.displayPhone.toLowerCase().contains(q) ||
          (c.code?.toLowerCase().contains(q) ?? false);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authSessionProvider);
    final scope = SessionScope.from(session);
    final asyncContacts = ref.watch(contactsListProvider(_filter));
    final listFilter = _filter == ContactRoleFilter.all ? null : _filter;
    final showBalances = scope != null &&
        canShowContactBalances(scope.permissions, listFilter);

    return ModuleScaffold(
      title: 'Contacts',
      body: Column(
        children: [
          ModuleSearchField(
            controller: _searchController,
            hint: 'Search name, phone, code…',
            onChanged: (v) => setState(() => _searchQuery = v),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: ContactRoleFilter.values.map((f) {
                final label = switch (f) {
                  ContactRoleFilter.all => 'All',
                  ContactRoleFilter.customer => 'Customers',
                  ContactRoleFilter.supplier => 'Suppliers',
                  ContactRoleFilter.worker => 'Workers',
                };
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(label),
                    selected: _filter == f,
                    onSelected: (_) => setState(() => _filter = f),
                  ),
                );
              }).toList(),
            ),
          ),
          Expanded(
            child: asyncContacts.when(
              loading: () => const AppLoading(message: 'Loading contacts…'),
              error: (e, _) => AppErrorState(
                message: e.toString().replaceFirst('Exception: ', ''),
                onRetry: () => ref.invalidate(contactsListProvider(_filter)),
              ),
              data: (contacts) {
                final filtered = _filterContacts(contacts);
                if (filtered.isEmpty) {
                  return const AppEmptyState(
                    title: 'No contacts found',
                    subtitle: 'Try another filter or check your access.',
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final contact = filtered[index];
                    final perms = scope?.permissions;
                    return _ContactListTile(
                      contact: contact,
                      showBalance: showBalances &&
                          perms != null &&
                          canShowContactBalance(perms, contact),
                      onTap: () => context.push('/contacts/${contact.id}'),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ContactListTile extends StatelessWidget {
  const _ContactListTile({
    required this.contact,
    required this.showBalance,
    required this.onTap,
  });

  final Contact contact;
  final bool showBalance;
  final VoidCallback onTap;

  String _roleLabel() {
    if (contact.roles.length > 1) return 'Customer & Supplier';
    return switch (contact.roles.first) {
      ContactRoleFilter.customer => 'Customer',
      ContactRoleFilter.supplier => 'Supplier',
      ContactRoleFilter.worker => 'Worker',
      ContactRoleFilter.all => contact.type ?? 'Contact',
    };
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
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
                      contact.name,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _roleLabel(),
                      style: const TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                    if (contact.displayPhone.isNotEmpty)
                      Text(
                        contact.displayPhone,
                        style: const TextStyle(color: AppColors.muted, fontSize: 12),
                      ),
                    if (contact.isSystemGenerated)
                      const Text(
                        'System contact',
                        style: TextStyle(color: AppColors.warning, fontSize: 11),
                      ),
                  ],
                ),
              ),
              if (showBalance)
                Text(
                  formatMoney(contact.balance),
                  style: TextStyle(
                    color: contact.balance >= 0
                        ? AppColors.success
                        : AppColors.error,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              const Icon(Icons.chevron_right, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}
