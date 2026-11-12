class InventoryItem {
  const InventoryItem({
    required this.id,
    required this.sku,
    required this.name,
    required this.stock,
    required this.minStock,
    required this.retailPrice,
    required this.costPrice,
    this.category,
  });

  final String id;
  final String sku;
  final String name;
  final double stock;
  final double minStock;
  final double retailPrice;
  final double costPrice;
  final String? category;

  bool get isLowStock => minStock > 0 && stock <= minStock;
  bool get isOutOfStock => stock <= 0;

  double get stockValue => stock * costPrice;

  String get stockStatusLabel {
    if (isOutOfStock) return 'Out';
    if (isLowStock) return 'Low';
    return 'OK';
  }
}
