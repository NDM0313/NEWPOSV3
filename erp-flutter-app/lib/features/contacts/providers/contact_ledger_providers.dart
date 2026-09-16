import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/session/session_scope.dart';
import '../../../data/repositories/party_ledger_repository.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/providers/repository_providers.dart';
import 'contacts_providers.dart';

class ContactLedgerData {
  const ContactLedgerData({required this.openingBalance, required this.lines});

  final double openingBalance;
  final List<PartyLedgerLine> lines;
}

final contactPartyLedgerProvider =
    FutureProvider.family<ContactLedgerData, String>((ref, contactId) async {
  final session = ref.watch(authSessionProvider);
  final scope = SessionScope.from(session);
  if (scope == null) {
    throw Exception('Session incomplete.');
  }

  final contact = await ref.watch(contactDetailProvider(contactId).future);
  if (contact == null) {
    throw Exception('Contact not found.');
  }

  final repo = ref.read(partyLedgerRepositoryProvider);
  final result = await repo.getLedgerForContact(
    companyId: scope.companyId,
    contactId: contactId,
    contactType: contact.type ?? 'customer',
    branchId: scope.listBranchId,
  );

  if (result.error != null) {
    throw Exception(result.error);
  }

  return ContactLedgerData(
    openingBalance: result.openingBalance,
    lines: result.lines,
  );
});
