import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_data_table.dart';
import '../../../core/widgets/app_empty_state.dart';
import '../../../core/widgets/app_error_state.dart';
import '../../../core/widgets/app_loading.dart';
import '../../../core/widgets/module_scaffold.dart';
import '../../../core/widgets/money_text.dart';
import '../../../data/models/inventory_item.dart';
import '../../barcode/barcode_scan_sheet.dart';
import '../providers/inventory_providers.dart';
import '../widgets/stock_adjustment_sheet.dart';
import '../widgets/stock_history_sheet.dart';

class InventoryListScreen extends ConsumerStatefulWidget {
  const InventoryListScreen({super.key});

  @override
  ConsumerState<InventoryListScreen> createState() => _InventoryListScreenState();
}

class _InventoryListScreenState extends ConsumerState<InventoryListScreen> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _scanBarcode() async {
    final code = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const BarcodeScanSheet()),
    );
    if (code == null || !mounted) return;
    ref.read(inventorySearchProvider.notifier).state = code;
    _searchController.text = code;
  }

  @override
  Widget build(BuildContext context) {
    final asyncItems = ref.watch(filteredInventoryProvider);

    return ModuleScaffold(
      title: 'Inventory',
      actions: [
        IconButton(
          onPressed: _scanBarcode,
          icon: const Icon(Icons.qr_code_scanner),
          tooltip: 'Scan barcode',
        ),
      ],
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: SearchBar(
              hintText: 'Search SKU or name…',
              controller: _searchController,
              onChanged: (v) => ref.read(inventorySearchProvider.notifier).state = v,
              leading: const Icon(Icons.search, color: AppColors.muted),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: InventoryFilter.values.map((f) {
                final selected = ref.watch(inventoryFilterProvider) == f;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(_filterLabel(f)),
                    selected: selected,
                    onSelected: (_) =>
                        ref.read(inventoryFilterProvider.notifier).state = f,
                  ),
                );
              }).toList(),
            ),
          ),
          Expanded(
            child: asyncItems.when(
              loading: () => const AppLoading(message: 'Loading stock…'),
              error: (e, _) => AppErrorState(
                message: e.toString().replaceFirst('Exception: ', ''),
                onRetry: () => ref.invalidate(inventoryListProvider),
              ),
              data: (items) {
                if (items.isEmpty) {
                  return const AppEmptyState(
                    title: 'No inventory items',
                    subtitle: 'Try another filter or add products first.',
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(inventoryListProvider),
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      AppDataTable(
                        columns: const [
                          DataColumn(label: Text('Product')),
                          DataColumn(label: Text('SKU')),
                          DataColumn(label: Text('Stock')),
                          DataColumn(label: Text('Status')),
                          DataColumn(label: Text('Value')),
                          DataColumn(label: Text('')),
                        ],
                        rows: items.map((item) => _row(context, item)).toList(),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  String _filterLabel(InventoryFilter f) {
    return switch (f) {
      InventoryFilter.all => 'All',
      InventoryFilter.low => 'Low',
      InventoryFilter.out => 'Out',
      InventoryFilter.healthy => 'Healthy',
    };
  }

  DataRow _row(BuildContext context, InventoryItem item) {
    final statusColor = item.isOutOfStock
        ? AppColors.error
        : item.isLowStock
            ? AppColors.warning
            : AppColors.success;

    return DataRow(
      cells: [
        DataCell(Text(item.name, overflow: TextOverflow.ellipsis)),
        DataCell(Text(item.sku)),
        DataCell(Text(formatQty(item.stock))),
        DataCell(
          Text(
            item.stockStatusLabel,
            style: TextStyle(color: statusColor, fontWeight: FontWeight.w600),
          ),
        ),
        DataCell(MoneyText(item.stockValue)),
        DataCell(
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                icon: const Icon(Icons.history, size: 20),
                tooltip: 'History',
                onPressed: () => showStockHistorySheet(context, item.id, item.name),
              ),
              IconButton(
                icon: const Icon(Icons.tune, size: 20),
                tooltip: 'Adjust',
                onPressed: () => _adjust(context, item),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _adjust(BuildContext context, InventoryItem item) async {
    final changed = await showStockAdjustmentSheet(
      context: context,
      productId: item.id,
      productName: item.name,
      currentStock: item.stock,
    );
    if (changed == true && mounted) {
      ref.invalidate(inventoryListProvider);
    }
  }
}