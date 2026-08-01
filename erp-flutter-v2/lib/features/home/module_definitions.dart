import 'package:flutter/material.dart';

import '../../core/permissions/permission_modules.dart';

class ModuleDefinition {
  const ModuleDefinition({
    required this.screen,
    required this.title,
    required this.icon,
    required this.color,
  });

  final ErpScreen screen;
  final String title;
  final IconData icon;
  final Color color;
}

/// Mirrors erp-mobile-app HomeScreen MODULES list (Phase 1: cards only).
const kAllModules = [
  ModuleDefinition(
    screen: ErpScreen.sales,
    title: 'Sales',
    icon: Icons.shopping_cart_outlined,
    color: Color(0xFF3B82F6),
  ),
  ModuleDefinition(
    screen: ErpScreen.purchase,
    title: 'Purchase',
    icon: Icons.shopping_bag_outlined,
    color: Color(0xFF10B981),
  ),
  ModuleDefinition(
    screen: ErpScreen.rental,
    title: 'Rental',
    icon: Icons.checkroom_outlined,
    color: Color(0xFF8B5CF6),
  ),
  ModuleDefinition(
    screen: ErpScreen.studio,
    title: 'Studio',
    icon: Icons.camera_alt_outlined,
    color: Color(0xFFEC4899),
  ),
  ModuleDefinition(
    screen: ErpScreen.accounts,
    title: 'Accounts',
    icon: Icons.attach_money,
    color: Color(0xFFF59E0B),
  ),
  ModuleDefinition(
    screen: ErpScreen.expense,
    title: 'Expense',
    icon: Icons.receipt_long_outlined,
    color: Color(0xFFEF4444),
  ),
  ModuleDefinition(
    screen: ErpScreen.products,
    title: 'Products',
    icon: Icons.inventory_2_outlined,
    color: Color(0xFF3B82F6),
  ),
  ModuleDefinition(
    screen: ErpScreen.inventory,
    title: 'Inventory',
    icon: Icons.warehouse_outlined,
    color: Color(0xFF10B981),
  ),
  ModuleDefinition(
    screen: ErpScreen.pos,
    title: 'Point of Sale',
    icon: Icons.storefront_outlined,
    color: Color(0xFF059669),
  ),
  ModuleDefinition(
    screen: ErpScreen.contacts,
    title: 'Contacts',
    icon: Icons.people_outline,
    color: Color(0xFF6366F1),
  ),
  ModuleDefinition(
    screen: ErpScreen.reports,
    title: 'Reports',
    icon: Icons.trending_up,
    color: Color(0xFF8B5CF6),
  ),
  ModuleDefinition(
    screen: ErpScreen.packing,
    title: 'Shipment & Cargo',
    icon: Icons.local_shipping_outlined,
    color: Color(0xFF0EA5E9),
  ),
  ModuleDefinition(
    screen: ErpScreen.ledger,
    title: 'Ledger',
    icon: Icons.menu_book_outlined,
    color: Color(0xFF84CC16),
  ),
  ModuleDefinition(
    screen: ErpScreen.settings,
    title: 'Settings',
    icon: Icons.settings_outlined,
    color: Color(0xFF6B7280),
  ),
  ModuleDefinition(
    screen: ErpScreen.dashboard,
    title: 'Dashboard',
    icon: Icons.dashboard_outlined,
    color: Color(0xFF3B82F6),
  ),
];
