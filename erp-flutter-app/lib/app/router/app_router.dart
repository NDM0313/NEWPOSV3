import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/widgets/app_loading.dart';
import '../../features/auth/providers/auth_session_provider.dart';
import '../../features/auth/screens/branch_selection_screen.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/contacts/screens/contact_create_screen.dart';
import '../../features/contacts/screens/contact_edit_screen.dart';
import '../../features/contacts/screens/contact_detail_screen.dart';
import '../../features/contacts/screens/contact_ledger_screen.dart';
import '../../features/contacts/screens/contacts_list_screen.dart';
import '../../features/dashboard/screens/dashboard_screen.dart';
import '../../features/expenses/screens/expense_create_screen.dart';
import '../../features/expenses/screens/expense_detail_screen.dart';
import '../../features/expenses/screens/expenses_list_screen.dart';
import '../../features/ledger/screens/journal_list_screen.dart';
import '../../features/home/home_screen.dart';
import '../../features/products/screens/product_create_screen.dart';
import '../../features/products/screens/product_edit_screen.dart';
import '../../features/products/screens/product_detail_screen.dart';
import '../../features/products/screens/products_list_screen.dart';
import '../../features/purchases/screens/purchase_create_screen.dart';
import '../../features/purchases/screens/purchase_detail_screen.dart';
import '../../features/purchases/screens/purchases_list_screen.dart';
import '../../features/sales/screens/sale_edit_screen.dart';
import '../../features/sales/screens/sale_create_screen.dart';
import '../../features/sales/screens/sale_return_screen.dart';
import '../../features/sales/screens/sale_detail_screen.dart';
import '../../features/accounts/screens/accounts_list_screen.dart';
import '../../features/pos/screens/pos_screen.dart';
import '../../features/rentals/screens/rentals_list_screen.dart';
import '../../features/settings/screens/settings_screen.dart';
import '../../features/studio/screens/studio_list_screen.dart';
import '../../features/sales/screens/sales_list_screen.dart';

GoRouter createAppRouter(AuthSessionState session) {
  return GoRouter(
    initialLocation: '/boot',
    redirect: (context, state) {
      final loc = state.matchedLocation;
      final status = session.status;

      if (status == AuthStatus.unknown || status == AuthStatus.loading) {
        return loc == '/boot' ? null : '/boot';
      }

      if (status == AuthStatus.error) {
        return loc == '/boot' ? null : '/boot';
      }

      if (status == AuthStatus.unauthenticated) {
        return loc == '/login' ? null : '/login';
      }

      if (status == AuthStatus.needsBranch) {
        return loc == '/branch' ? null : '/branch';
      }

      if (status == AuthStatus.authenticated) {
        if (loc == '/login' || loc == '/boot') {
          return '/home';
        }
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/boot',
        builder: (context, state) => const _BootScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/branch',
        builder: (context, state) => const BranchSelectionScreen(),
      ),
      GoRoute(
        path: '/home',
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/contacts',
        builder: (context, state) => const ContactsListScreen(),
        routes: [
          GoRoute(
            path: 'new',
            builder: (context, state) => const ContactCreateScreen(),
          ),
          GoRoute(
            path: ':id',
            builder: (context, state) {
              final id = state.pathParameters['id']!;
              return ContactDetailScreen(contactId: id);
            },
            routes: [
              GoRoute(
                path: 'edit',
                builder: (context, state) {
                  final id = state.pathParameters['id']!;
                  return ContactEditScreen(contactId: id);
                },
              ),
              GoRoute(
                path: 'ledger',
                builder: (context, state) {
                  final id = state.pathParameters['id']!;
                  return ContactLedgerScreen(contactId: id);
                },
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/products',
        builder: (context, state) => const ProductsListScreen(),
        routes: [
          GoRoute(
            path: 'new',
            builder: (context, state) => const ProductCreateScreen(),
          ),
          GoRoute(
            path: ':id',
            builder: (context, state) {
              final id = state.pathParameters['id']!;
              return ProductDetailScreen(productId: id);
            },
            routes: [
              GoRoute(
                path: 'edit',
                builder: (context, state) {
                  final id = state.pathParameters['id']!;
                  return ProductEditScreen(productId: id);
                },
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/dashboard',
        builder: (context, state) => const DashboardScreen(),
      ),
      GoRoute(
        path: '/sales',
        builder: (context, state) => const SalesListScreen(),
        routes: [
          GoRoute(
            path: 'new',
            builder: (context, state) => const SaleCreateScreen(),
          ),
          GoRoute(
            path: ':id',
            builder: (context, state) {
              final id = state.pathParameters['id']!;
              return SaleDetailScreen(saleId: id);
            },
            routes: [
              GoRoute(
                path: 'edit',
                builder: (context, state) {
                  final id = state.pathParameters['id']!;
                  return SaleEditScreen(saleId: id);
                },
              ),
              GoRoute(
                path: 'return',
                builder: (context, state) {
                  final id = state.pathParameters['id']!;
                  return SaleReturnScreen(saleId: id);
                },
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/expenses',
        builder: (context, state) => const ExpensesListScreen(),
        routes: [
          GoRoute(
            path: 'new',
            builder: (context, state) => const ExpenseCreateScreen(),
          ),
          GoRoute(
            path: ':id',
            builder: (context, state) {
              final id = state.pathParameters['id']!;
              return ExpenseDetailScreen(expenseId: id);
            },
          ),
        ],
      ),
      GoRoute(
        path: '/purchases',
        builder: (context, state) => const PurchasesListScreen(),
        routes: [
          GoRoute(
            path: 'new',
            builder: (context, state) => const PurchaseCreateScreen(),
          ),
          GoRoute(
            path: ':id',
            builder: (context, state) {
              final id = state.pathParameters['id']!;
              return PurchaseDetailScreen(purchaseId: id);
            },
          ),
        ],
      ),
      GoRoute(
        path: '/rentals',
        builder: (context, state) => const RentalsListScreen(),
      ),
      GoRoute(
        path: '/studio',
        builder: (context, state) => const StudioListScreen(),
      ),
      GoRoute(
        path: '/accounts',
        builder: (context, state) => const AccountsListScreen(),
      ),
      GoRoute(
        path: '/ledger',
        builder: (context, state) => const JournalListScreen(),
      ),
      GoRoute(
        path: '/pos',
        builder: (context, state) => const PosScreen(),
      ),
      GoRoute(
        path: '/settings',
        builder: (context, state) => const SettingsScreen(),
      ),
    ],
  );
}

class _BootScreen extends ConsumerWidget {
  const _BootScreen();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authSessionProvider);

    if (session.status == AuthStatus.error) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  session.errorMessage ?? 'Startup error',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () =>
                      ref.read(authSessionProvider.notifier).bootstrap(),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return const Scaffold(body: AppLoading(message: 'Starting…'));
  }
}
