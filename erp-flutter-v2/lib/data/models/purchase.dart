bool isPurchaseStatusFinalizable(String status) {
  final s = status.toLowerCase();
  return s == 'draft' || s == 'ordered';
}

bool isPurchaseStatusPosted(String status) {
  final s = status.toLowerCase();
  return s == 'final' || s == 'received';
}

class PurchaseListItem {
  const PurchaseListItem({
    required this.id,
    required this.documentNo,
    required this.supplierName,
    required this.total,
    required this.paid,
    required this.due,
    required this.status,
    required this.paymentStatus,
    required this.date,
    this.itemCount = 0,
  });

  final String id;
  final String documentNo;
  final String supplierName;
  final double total;
  final double paid;
  final double due;
  final String status;
  final String paymentStatus;
  final String date;
  final int itemCount;
}

class PurchaseLineItem {
  const PurchaseLineItem({
    required this.id,
    required this.productName,
    required this.sku,
    required this.quantity,
    required this.unitPrice,
    required this.total,
  });

  final String id;
  final String productName;
  final String sku;
  final double quantity;
  final double unitPrice;
  final double total;
}

class PurchaseDetail {
  const PurchaseDetail({
    required this.id,
    required this.documentNo,
    required this.status,
    required this.paymentStatus,
    required this.supplierName,
    required this.date,
    required this.branchName,
    required this.total,
    required this.paid,
    required this.due,
    required this.subtotal,
    required this.discount,
    required this.tax,
    required this.shipping,
    required this.items,
    this.notes,
  });

  final String id;
  final String documentNo;
  final String status;
  final String paymentStatus;
  final String supplierName;
  final String date;
  final String branchName;
  final double total;
  final double paid;
  final double due;
  final double subtotal;
  final double discount;
  final double tax;
  final double shipping;
  final List<PurchaseLineItem> items;
  final String? notes;
}
