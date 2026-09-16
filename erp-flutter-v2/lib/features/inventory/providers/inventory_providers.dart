import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/inventory_item.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';

enum InventoryFilter { all, low, out, healthy }

final inventoryFilterProvider = StateProvider<InventoryFilter>((ref) {
  return InventoryFilter.all;
});

final inventorySearchProvider = StateProvider<String>((ref) => '');

final inventoryListProvider = FutureProvider<List<InventoryItem>>((ref) async {
  final session = ref.watch(authSessionProvider);
  final companyId = session.companyId;
  final branch = session.selectedBranch;
  if (companyId == null || branch == null) return [];

  final repo = ref.watch(inventoryRepositoryProvider);
  return repo.fetchInventory(
    companyId: companyId,
    branchId: branch.id,
  );
});

final filteredInventoryProvider = Provider<AsyncValue<List<InventoryItem>>>((ref) {
  final asyncItems = ref.watch(inventoryListProvider);
  final filter = ref.watch(inventoryFilterProvider);
  final search = ref.watch(inventorySearchProvider).trim().toLowerCase();

  return asyncItems.whenData((items) {
    var list = items;
    switch (filter) {
      case InventoryFilter.low:
        list = list.where((i) => i.isLowStock && !i.isOutOfStock).toList();
      case InventoryFilter.out:
        list = list.where((i) => i.isOutOfStock).toList();
      case InventoryFilter.healthy:
        list = list.where((i) => !i.isLowStock && !i.isOutOfStock).toList();
      case InventoryFilter.all:
        break;
    }
    if (search.isNotEmpty) {
      list = list
          .where(
            (i) =>
                i.name.toLowerCase().contains(search) ||
                i.sku.toLowerCase().contains(search),
          )
          .toList();
    }
    return list;
  });
});

final productMovementsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, productId) async {
  final session = ref.watch(authSessionProvider);
  final companyId = session.companyId;
  final branch = session.selectedBranch;
  if (companyId == null) return [];

  final repo = ref.watch(inventoryRepositoryProvider);
  return repo.fetchProductMovements(
    companyId: companyId,
    productId: productId,
    branchId: branch?.id,
  );
});
