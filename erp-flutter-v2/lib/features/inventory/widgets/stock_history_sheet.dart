import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/app_loading.dart';
import '../providers/inventory_providers.dart';

void showStockHistorySheet(
  BuildContext context,
  String productId,
  String productName,
) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.55,
      builder: (_, controller) => _StockHistoryBody(
        productId: productId,
        productName: productName,
        scrollController: controller,
      ),
    ),
  );
}

class _StockHistoryBody extends ConsumerWidget {
  const _StockHistoryBody({
    required this.productId,
    required this.productName,
    required this.scrollController,
  });

  final String productId;
  final String productName;
  final ScrollController scrollController;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncMovements = ref.watch(productMovementsProvider(productId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Text(
            'Stock history — $productName',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
        Expanded(
          child: asyncMovements.when(
            loading: () => const AppLoading(message: 'Loading movements…'),
            error: (e, _) => Center(child: Text(e.toString())),
            data: (rows) {
              if (rows.isEmpty) {
                return const Center(child: Text('No movements yet.'));
              }
              return ListView.builder(
                controller: scrollController,
                itemCount: rows.length,
                itemBuilder: (_, i) {
                  final m = rows[i];
                  final qty = (m['quantity'] as num?)?.toDouble() ?? 0;
                  final type = m['movement_type']?.toString() ?? '—';
                  final date = m['created_at']?.toString().split('T').first ?? '';
                  return ListTile(
                    title: Text('$type · ${qty >= 0 ? '+' : ''}$qty'),
                    subtitle: Text(
                      '${m['reference_type'] ?? ''} · ${m['notes'] ?? ''}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: Text(date, style: const TextStyle(fontSize: 12)),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}
