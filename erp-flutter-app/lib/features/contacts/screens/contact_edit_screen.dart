import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../auth/providers/repository_providers.dart';
import '../../../data/models/contact.dart';
import '../providers/contacts_providers.dart';

class ContactEditScreen extends ConsumerStatefulWidget {
  const ContactEditScreen({super.key, required this.contactId});

  final String contactId;

  @override
  ConsumerState<ContactEditScreen> createState() => _ContactEditScreenState();
}

class _ContactEditScreenState extends ConsumerState<ContactEditScreen> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _cityController = TextEditingController();
  final _addressController = TextEditingController();
  bool _active = true;
  bool _saving = false;
  bool _loaded = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _cityController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  void _loadContact(Contact contact) {
    if (_loaded) return;
    _nameController.text = contact.name;
    _phoneController.text = contact.displayPhone;
    _emailController.text = contact.email ?? '';
    _cityController.text = contact.city ?? '';
    _addressController.text = contact.address ?? '';
    _active = contact.status == ContactStatus.active;
    _loaded = true;
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });

    final repo = ref.read(contactsWriteRepositoryProvider);
    final result = await repo.updateContact(
      contactId: widget.contactId,
      name: _nameController.text,
      phone: _phoneController.text,
      email: _emailController.text,
      city: _cityController.text,
      address: _addressController.text,
      active: _active,
    );

    if (!mounted) return;

    if (!result.success) {
      setState(() {
        _saving = false;
        _error = result.error ?? 'Update failed.';
      });
      return;
    }

    for (final f in ContactRoleFilter.values) {
      ref.invalidate(contactsListProvider(f));
    }
    ref.invalidate(contactDetailProvider(widget.contactId));
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final asyncContact = ref.watch(contactDetailProvider(widget.contactId));

    return ModuleScaffold(
      title: 'Edit contact',
      body: asyncContact.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(e.toString())),
        data: (contact) {
          if (contact == null) {
            return const Center(child: Text('Contact not found.'));
          }
          _loadContact(contact);

          return ListView(
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
              TextField(
                controller: _phoneController,
                decoration: const InputDecoration(labelText: 'Phone', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _emailController,
                decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _cityController,
                decoration: const InputDecoration(labelText: 'City', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _addressController,
                decoration: const InputDecoration(labelText: 'Address', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 8),
              SwitchListTile(
                title: const Text('Active'),
                value: _active,
                onChanged: (v) => setState(() => _active = v),
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
                    : const Text('Save changes'),
              ),
            ],
          );
        },
      ),
    );
  }
}
