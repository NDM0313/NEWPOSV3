import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme/app_colors.dart';
import '../../core/permissions/permission_modules.dart';
import '../../features/auth/providers/auth_session_provider.dart';
import '../../features/home/module_definitions.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/router/module_navigation.dart';

/// MD3 bottom navigation — home, sales, POS, contacts, more.
class AppBottomNav extends ConsumerWidget {
  const AppBottomNav({super.key, required this.currentPath});

  final String currentPath;

  int get _selectedIndex {
    if (currentPath.startsWith('/sales')) return 1;
    if (currentPath.startsWith('/pos')) return 2;
    if (currentPath.startsWith('/contacts')) return 3;
    if (currentPath == '/home') return 0;
    return 0;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final perms = ref.watch(authSessionProvider).permissions;
    if (!perms.isLoaded) return const SizedBox.shrink();

    return NavigationBar(
      selectedIndex: _selectedIndex.clamp(0, 4),
      onDestinationSelected: (index) {
        switch (index) {
          case 0:
            context.go('/home');
          case 1:
            if (perms.canViewScreen(ErpScreen.sales)) context.go('/sales');
          case 2:
            if (perms.canViewScreen(ErpScreen.pos)) context.go('/pos');
          case 3:
            if (perms.canViewScreen(ErpScreen.contacts)) context.go('/contacts');
          case 4:
            _showMoreModules(context, ref);
        }
      },
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.home_outlined),
          selectedIcon: Icon(Icons.home),
          label: 'Home',
        ),
        NavigationDestination(
          icon: Icon(Icons.shopping_cart_outlined),
          selectedIcon: Icon(Icons.shopping_cart),
          label: 'Sales',
        ),
        NavigationDestination(
          icon: Icon(Icons.storefront_outlined),
          selectedIcon: Icon(Icons.storefront),
          label: 'POS',
        ),
        NavigationDestination(
          icon: Icon(Icons.people_outline),
          selectedIcon: Icon(Icons.people),
          label: 'Contacts',
        ),
        NavigationDestination(
          icon: Icon(Icons.apps_outlined),
          selectedIcon: Icon(Icons.apps),
          label: 'More',
        ),
      ],
    );
  }

  void _showMoreModules(BuildContext context, WidgetRef ref) {
    final perms = ref.read(authSessionProvider).permissions;
    final modules = kAllModules.where((m) {
      if (m.screen == ErpScreen.settings) return true;
      return perms.canViewScreen(m.screen);
    }).toList();

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.55,
          builder: (_, controller) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text(
                    'All modules',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
                Expanded(
                  child: GridView.builder(
                    controller: controller,
                    padding: const EdgeInsets.all(16),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 1,
                    ),
                    itemCount: modules.length,
                    itemBuilder: (_, i) {
                      final m = modules[i];
                      return Material(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        child: InkWell(
                          onTap: () {
                            Navigator.pop(ctx);
                            navigateModuleOrPlaceholder(context, m.screen, m.title);
                          },
                          borderRadius: BorderRadius.circular(12),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(m.icon, color: m.color),
                              const SizedBox(height: 8),
                              Text(
                                m.title,
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }
}

/// Wraps tab-root screens with bottom navigation.
class MainShell extends StatelessWidget {
  const MainShell({
    super.key,
    required this.child,
    required this.currentPath,
  });

  final Widget child;
  final String currentPath;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: AppBottomNav(currentPath: currentPath),
    );
  }
}
