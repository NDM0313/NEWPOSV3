import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/permissions/contact_balance_visibility.dart';
import '../../../core/session/session_scope.dart';
import '../../../data/models/contact.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';

final contactsListProvider =
    FutureProvider.family<List<Contact>, ContactRoleFilter>((ref, filter) async {
  final session = ref.watch(authSessionProvider);
  final scope = SessionScope.from(session);
  if (scope == null) {
    throw Exception('Session incomplete. Sign in and select a branch.');
  }

  final listFilter = filter == ContactRoleFilter.all ? null : filter;
  final includeBalances = canShowContactBalances(scope.permissions, listFilter);

  final repo = ref.read(contactsRepositoryProvider);
  final result = await repo.getContacts(
    companyId: scope.companyId,
    type: listFilter,
    branchId: scope.branchId,
    includeBalances: includeBalances,
  );

  if (result.error != null) {
    throw Exception(result.error);
  }
  return result.contacts;
});

final contactDetailProvider =
    FutureProvider.family<Contact?, String>((ref, contactId) async {
  final session = ref.watch(authSessionProvider);
  final scope = SessionScope.from(session);
  if (scope == null) {
    throw Exception('Session incomplete.');
  }

  final repo = ref.read(contactsRepositoryProvider);
  final result = await repo.getContactById(
    companyId: scope.companyId,
    contactId: contactId,
    branchId: scope.branchId,
    includeBalances: true,
  );

  if (result.error != null) {
    throw Exception(result.error);
  }

  final contact = result.contact;
  if (contact == null) return null;

  if (!canShowContactBalance(scope.permissions, contact)) {
    return Contact(
      id: contact.id,
      name: contact.name,
      roles: contact.roles,
      phone: contact.phone,
      mobile: contact.mobile,
      email: contact.email,
      address: contact.address,
      city: contact.city,
      balance: 0,
      creditLimit: contact.creditLimit,
      status: contact.status,
      code: contact.code,
      type: contact.type,
      isSystemGenerated: contact.isSystemGenerated,
    );
  }

  return contact;
});
