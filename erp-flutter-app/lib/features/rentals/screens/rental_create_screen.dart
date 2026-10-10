import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/session/session_scope.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/local_date.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../data/models/contact.dart';
import '../../../data/models/product.dart';
import '../../../data/repositories/rentals_write_repository.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';
import '../../contacts/providers/contacts_providers.dart';
import '../../products/providers/products_providers.dart';
import '../providers/rentals_providers.dart';

class RentalCreateScreen extends ConsumerStatefulWidget {
  const RentalCreateScreen({super.key});

  @override
  ConsumerState<RentalCreateScreen> createState() => _RentalCreateScreenState();
}

class _RentalLine {
  _RentalLine({required this.product, required this.quantity, required this.ratePerDay});

  final Product product;
  double quantity;
  double ratePerDay;

  double totalForDays(int days) => quantity * ratePerDay * days;
}

class _RentalCreateScreenState extends ConsumerState<RentalCreateScreen> {
  Contact? _customer;
  DateTime _pickup = DateTime.now();
  DateTime _return = DateTime.now().add(const Duration(days: 3));
  final List<_RentalLine> _lines = [];
  bool _saving = false;
  String? _error;

  int get _durationDays {
    final d = _return.difference(_pickup).inDays;
    return d <= 0 ? 1 : d;
  }

  double get _total => _lines.fold(0, (sum, l) => sum + l.totalForDays(_durationDays));

  Future<void> _pickCustomer() async {
    final contacts = await ref.read(contactsListProvider(ContactRoleFilter.customer).future);
    if (!mounted) return;
    if (contacts.isEmpty) {
      setState(() => _error = 'No customers found. Create a customer first.');
      return;
    }

    final picked = await showModalBottomSheet<Contact>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.6,
          builder: (_, controller) {
            return ListView.builder(
              controller: controller,
              itemCount: contacts.length,
              itemBuilder: (_, i) {
                final c = contacts[i];
                return ListTile(
                  title: Text(c.name),
                  subtitle: Text(c.code ?? c.displayPhone),
                  onTap: () => Navigator.pop(ctx, c),
                );
              },
            );
          },
        );
      },
    );

    if (picked != null) {
      setState(() {
        _customer = picked;
        _error = null;
      });
    }
  }

  Future<void> _pickProduct() async {
    final products = await ref.read(productsListProvider.future);
    if (!mounted) return;
    if (products.isEmpty) {
      setState(() => _error = 'No products available.');
      return;
    }

    final picked = await showModalBottomSheet<Product>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.6,
          builder: (_, controller) {
            return ListView.builder(
              controller: controller,
              itemCount: products.length,
              itemBuilder: (_, i) {
                final p = products[i];
                return ListTile(
                  title: Text(p.name),
                  subtitle: Text('${p.sku} · ${formatMoney(p.retailPrice)}/day'),
                  onTap: () => Navigator.pop(ctx, p),
                );
              },
            );
          },
        );
      },
    );

    if (picked != null) {
      setState(() {
        _lines.add(_RentalLine(product: picked, quantity: 1, ratePerDay: picked.retailPrice));
        _error = null;
      });
    }
  }

  Future<void> _save() async {
    final scope = SessionScope.from(ref.read(authSessionProvider));
    if (scope == null || scope.branchId == null) {
      setState(() => _error = 'Session or branch missing.');
      return;
    }
    if (_customer == null) {
      setState(() => _error = 'Select a customer.');
      return;
    }
    if (_lines.isEmpty) {
      setState(() => _error = 'Add at least one rental item.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    final days = _durationDays;
    final items = _lines
        .map(
          (l) => RentalBookingLineInput(
            productId: l.product.id,
            productName: l.product.name,
            quantity: l.quantity,
            ratePerDay: l.ratePerDay,
            durationDays: days,
            total: l.totalForDays(days),
          ),
        )
        .toList();

    final repo = ref.read(rentalsWriteRepositoryProvider);
    final result = await repo.createRentalBooking(
      companyId: scope.companyId,
      branchId: scope.branchId!,
      createdBy: scope.authUserId,
      customerId: _customer!.id,
      customerName: _customer!.name,
      pickupDate: formatLocalDateIso(_pickup),
      returnDate: formatLocalDateIso(_return),
      items: items,
    );

    if (!mounted) return;

    if (result.error != null || result.rentalId == null) {
      setState(() {
        _saving = false;
        _error = result.error ?? 'Create failed.';
      });
      return;
    }

    ref.invalidate(rentalsListProvider);
    context.pop();
    context.push('/rentals/${result.rentalId}');
  }

  @override
  Widget build(BuildContext context) {
    return ModuleScaffold(
      title: 'New rental',
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!, style: const TextStyle(color: AppColors.error)),
            ),
          ListTile(
            title: const Text('Customer'),
            subtitle: Text(_customer?.name ?? 'Tap to select'),
            trailing: const Icon(Icons.chevron_right),
            onTap: _pickCustomer,
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: ListTile(
                  title: const Text('Pickup'),
                  subtitle: Text(formatLocalDateIso(_pickup)),
                  onTap: () async {
                    final d = await showDatePicker(
                      context: context,
                      initialDate: _pickup,
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2100),
                    );
                    if (d != null) setState(() => _pickup = d);
                  },
                ),
              ),
              Expanded(
                child: ListTile(
                  title: const Text('Return'),
                  subtitle: Text(formatLocalDateIso(_return)),
                  onTap: () async {
                    final d = await showDatePicker(
                      context: context,
                      initialDate: _return,
                      firstDate: _pickup,
                      lastDate: DateTime(2100),
                    );
                    if (d != null) setState(() => _return = d);
                  },
                ),
              ),
            ],
          ),
          Text('Duration: $_durationDays day(s)', style: const TextStyle(color: AppColors.muted)),
          const SizedBox(height: 12),
          ..._lines.map(
            (l) => ListTile(
              title: Text(l.product.name),
              subtitle: Text(
                'Qty ${l.quantity} · ${formatMoney(l.ratePerDay)}/day · ${formatMoney(l.totalForDays(_durationDays))}',
              ),
            ),
          ),
          OutlinedButton(onPressed: _pickProduct, child: const Text('Add product')),
          const SizedBox(height: 16),
          Text('Total: ${formatMoney(_total)}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Create booking'),
          ),
        ],
      ),
    );
  }
}
