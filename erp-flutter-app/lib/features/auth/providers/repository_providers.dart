import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/repositories/accounts_read_repository.dart';
import '../../../data/repositories/auth_repository.dart';
import '../../../data/repositories/branch_repository.dart';
import '../../../data/repositories/contacts_repository.dart';
import '../../../data/repositories/contacts_write_repository.dart';
import '../../../data/repositories/expenses_write_repository.dart';
import '../../../data/repositories/journal_read_repository.dart';
import '../../../data/repositories/party_ledger_repository.dart';
import '../../../data/repositories/products_write_repository.dart';
import '../../../data/repositories/dashboard_repository.dart';
import '../../../data/repositories/expenses_read_repository.dart';
import '../../../data/repositories/permission_repository.dart';
import '../../../data/repositories/products_repository.dart';
import '../../../data/repositories/purchases_read_repository.dart';
import '../../../data/repositories/purchases_write_repository.dart';
import '../../../data/repositories/sales_read_repository.dart';
import '../../../data/repositories/rentals_read_repository.dart';
import '../../../data/repositories/rentals_write_repository.dart';
import '../../../data/repositories/sales_write_repository.dart';
import '../../../data/repositories/studio_read_repository.dart';
import '../../../data/repositories/studio_invoice_repository.dart';
import '../../../data/repositories/studio_write_repository.dart';
import '../../../data/repositories/settings_repository.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) => AuthRepository());

final branchRepositoryProvider = Provider<BranchRepository>((ref) => BranchRepository());

final permissionRepositoryProvider =
    Provider<PermissionRepository>((ref) => PermissionRepository());

final settingsRepositoryProvider =
    Provider<SettingsRepository>((ref) => SettingsRepository());

final contactsRepositoryProvider =
    Provider<ContactsRepository>((ref) => ContactsRepository());

final productsRepositoryProvider =
    Provider<ProductsRepository>((ref) => ProductsRepository());

final dashboardRepositoryProvider =
    Provider<DashboardRepository>((ref) => DashboardRepository());

final salesReadRepositoryProvider =
    Provider<SalesReadRepository>((ref) => SalesReadRepository());

final purchasesReadRepositoryProvider =
    Provider<PurchasesReadRepository>((ref) => PurchasesReadRepository());

final expensesReadRepositoryProvider =
    Provider<ExpensesReadRepository>((ref) => ExpensesReadRepository());

final salesWriteRepositoryProvider =
    Provider<SalesWriteRepository>((ref) => SalesWriteRepository());

final purchasesWriteRepositoryProvider =
    Provider<PurchasesWriteRepository>((ref) => PurchasesWriteRepository());

final rentalsReadRepositoryProvider =
    Provider<RentalsReadRepository>((ref) => RentalsReadRepository());

final rentalsWriteRepositoryProvider =
    Provider<RentalsWriteRepository>((ref) => RentalsWriteRepository());

final studioReadRepositoryProvider =
    Provider<StudioReadRepository>((ref) => StudioReadRepository());

final studioWriteRepositoryProvider =
    Provider<StudioWriteRepository>((ref) => StudioWriteRepository());

final studioInvoiceRepositoryProvider =
    Provider<StudioInvoiceRepository>((ref) => StudioInvoiceRepository());

final accountsReadRepositoryProvider =
    Provider<AccountsReadRepository>((ref) => AccountsReadRepository());

final contactsWriteRepositoryProvider =
    Provider<ContactsWriteRepository>((ref) => ContactsWriteRepository());

final productsWriteRepositoryProvider =
    Provider<ProductsWriteRepository>((ref) => ProductsWriteRepository());

final expensesWriteRepositoryProvider =
    Provider<ExpensesWriteRepository>((ref) => ExpensesWriteRepository());

final partyLedgerRepositoryProvider =
    Provider<PartyLedgerRepository>((ref) => PartyLedgerRepository());

final journalReadRepositoryProvider =
    Provider<JournalReadRepository>((ref) => JournalReadRepository());
