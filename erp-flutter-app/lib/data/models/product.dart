class Product {
  const Product({
    required this.id,
    required this.sku,
    required this.name,
    required this.category,
    required this.costPrice,
    required this.retailPrice,
    required this.stock,
    required this.unit,
    this.barcode,
    this.minStock = 0,
    this.wholesalePrice,
    this.hasVariations = false,
    this.description,
    this.status = ProductStatus.active,
  });

  final String id;
  final String sku;
  final String name;
  final String category;
  final double costPrice;
  final double retailPrice;
  final double stock;
  final String unit;
  final String? barcode;
  final double minStock;
  final double? wholesalePrice;
  final bool hasVariations;
  final String? description;
  final ProductStatus status;
}

enum ProductStatus { active, inactive }
