import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/session/session_scope.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../data/models/contact.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';
import '../providers/contacts_providers.dart';

class ContactCreateScreen extends ConsumerStatefulWidget {
  const ContactCreateScreen({super.key});

  @override
  ConsumerState<ContactCreateScreen> createState() => _ContactCreateScreenState();
}

class _ContactCreateScreenState extends ConsumerState<ContactCreateScreen> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  String _role = 'customer';
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final scope = SessionScope.from(ref.read(authSessionProvider));
    if (scope == null) {
      setState(() => _error = 'Session missing.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    final repo = ref.read(contactsWriteRepositoryProvider);
    final result = await repo.createContact(
      companyId: scope.companyId,
      name: _nameController.text,
      role: _role,
      phone: _phoneController.text,
      email: _emailController.text,
    );

    if (!mounted) return;

    if (result.error != null || result.contactId == null) {
      setState(() {
        _saving = false;
        _error = result.error ?? 'Create failed.';
      });
      return;
    }

    for (final f in ContactRoleFilter.values) {
      ref.invalidate(contactsListProvider(f));
    }
    context.pop();
    context.push('/contacts/${result.contactId}');
  }

  @override
  Widget build(BuildContext context) {
    return ModuleScaffold(
      title: 'New contact',
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!, style: const TextStyle(color: AppColors.error)),
            ),
          TextField(
            controller: _nameController,
            decoration: const InputDecoration(labelText: 'Name', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _role,
            decoration: const InputDecoration(labelText: 'Type', border: OutlineInputBorder()),
            items: const [
              DropdownMenuItem(value: 'customer', child: Text('Customer')),
              DropdownMenuItem(value: 'supplier', child: Text('Supplier')),
              DropdownMenuItem(value: 'worker', child: Text('Worker')),
            ],
            onChanged: (v) => setState(() => _role = v ?? 'customer'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _phoneController,
            decoration: const InputDecoration(labelText: 'Phone', border: OutlineInputBorder()),
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _emailController,
            decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder()),
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Create contact'),
          ),
        ],
      ),
    );
  }
}
