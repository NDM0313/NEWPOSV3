import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/permissions/permission_modules.dart';
import '../../../core/session/session_scope.dart';
import '../../../data/models/product.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';

bool productStockVisible(SessionScope scope) {
  return scope.permissions.hasPermission('inventory.view') ||
      scope.permissions.canViewScreen(ErpScreen.products);
}

bool productCostVisible(SessionScope scope) {
  return scope.permissions.hasPermission('inventory.view') &&
      (scope.permissions.isAdminOrOwner ||
          scope.permissions.hasPermission('inventory.adjust'));
}

final productsListProvider = FutureProvider<List<Product>>((ref) async {
  final session = ref.watch(authSessionProvider);
  final scope = SessionScope.from(session);
  if (scope == null) {
    throw Exception('Session incomplete. Sign in and select a branch.');
  }

  final includeStock = productStockVisible(scope);
  final repo = ref.read(productsRepositoryProvider);
  final result = await repo.getProducts(
    companyId: scope.companyId,
    branchId: scope.branchId,
    includeStock: includeStock,
  );

  if (result.error != null) {
    throw Exception(result.error);
  }
  return result.products;
});

final productDetailProvider =
    FutureProvider.family<Product?, String>((ref, productId) async {
  final session = ref.watch(authSessionProvider);
  final scope = SessionScope.from(session);
  if (scope == null) {
    throw Exception('Session incomplete.');
  }

  final includeStock = productStockVisible(scope);
  final repo = ref.read(productsRepositoryProvider);
  final result = await repo.getProductById(
    companyId: scope.companyId,
    productId: productId,
    branchId: scope.branchId,
    includeStock: includeStock,
  );

  if (result.error != null) {
    throw Exception(result.error);
  }
  return result.product;
});
