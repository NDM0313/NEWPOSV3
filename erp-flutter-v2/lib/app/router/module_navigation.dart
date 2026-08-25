import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/permissions/permission_modules.dart';

void navigateModuleOrPlaceholder(BuildContext context, ErpScreen screen, String title) {
  switch (screen) {
    case ErpScreen.contacts:
      context.push('/contacts');
      return;
    case ErpScreen.products:
      context.push('/products');
      return;
    case ErpScreen.dashboard:
      context.push('/dashboard');
      return;
    case ErpScreen.sales:
      context.push('/sales');
      return;
    case ErpScreen.purchase:
      context.push('/purchases');
      return;
    case ErpScreen.expense:
      context.push('/expenses');
      return;
    case ErpScreen.inventory:
      context.push('/inventory');
      return;
    case ErpScreen.reports:
      context.push('/reports');
      return;
    case ErpScreen.rental:
      context.push('/rentals');
      return;
    case ErpScreen.studio:
      context.push('/studio');
      return;
    case ErpScreen.accounts:
      context.push('/accounts');
      return;
    case ErpScreen.ledger:
      context.push('/ledger');
      return;
    case ErpScreen.pos:
      context.push('/pos');
      return;
    case ErpScreen.packing:
      context.push('/sales');
      return;
    case ErpScreen.settings:
      context.push('/settings');
      return;
    default:
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$title — coming in a later phase')),
      );
  }
}
