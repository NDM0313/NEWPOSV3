bool isSaleStatusFinalizable(String status) {
  final s = status.toLowerCase();
  return s == 'draft' || s == 'quotation' || s == 'order';
}

bool isSaleStatusPosted(String status) => status.toLowerCase() == 'final';

class SaleListItem {
  const SaleListItem({
    required this.id,
    required this.documentNo,
    required this.customerName,
    required this.total,
    required this.paid,
    required this.due,
    required this.status,
    required this.paymentStatus,
    required this.date,
    this.branchName,
    this.isStudio = false,
  });

  final String id;
  final String documentNo;
  final String customerName;
  final double total;
  final double paid;
  final double due;
  final String status;
  final String paymentStatus;
  final String date;
  final String? branchName;
  final bool isStudio;
}

class SaleLineItem {
  const SaleLineItem({
    required this.id,
    required this.productId,
    required this.productName,
    required this.sku,
    required this.quantity,
    required this.unitPrice,
    required this.total,
  });

  final String id;
  final String productId;
  final String productName;
  final String sku;
  final double quantity;
  final double unitPrice;
  final double total;
}

class SalePaymentSummary {
  const SalePaymentSummary({
    required this.id,
    required this.amount,
    required this.paymentDate,
    required this.method,
  });

  final String id;
  final double amount;
  final String paymentDate;
  final String method;
}

class SaleDetail {
  const SaleDetail({
    required this.id,
    required this.documentNo,
    required this.status,
    required this.paymentStatus,
    required this.customerName,
    required this.date,
    required this.branchName,
    required this.total,
    required this.paid,
    required this.due,
    required this.subtotal,
    required this.discount,
    required this.tax,
    required this.items,
    required this.payments,
    this.notes,
    this.isStudio = false,
  });

  final String id;
  final String documentNo;
  final String status;
  final String paymentStatus;
  final String customerName;
  final String date;
  final String branchName;
  final double total;
  final double paid;
  final double due;
  final double subtotal;
  final double discount;
  final double tax;
  final List<SaleLineItem> items;
  final List<SalePaymentSummary> payments;
  final String? notes;
  final bool isStudio;
}
