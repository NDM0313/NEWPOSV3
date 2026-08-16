class ExpenseListItem {
  const ExpenseListItem({
    required this.id,
    required this.expenseNo,
    required this.date,
    required this.category,
    required this.description,
    required this.amount,
    required this.status,
    required this.paymentMethod,
    this.vendorName,
  });

  final String id;
  final String expenseNo;
  final String date;
  final String category;
  final String description;
  final double amount;
  final String status;
  final String paymentMethod;
  final String? vendorName;
}

class ExpenseDetail {
  const ExpenseDetail({
    required this.id,
    required this.expenseNo,
    required this.date,
    required this.category,
    required this.description,
    required this.amount,
    required this.status,
    required this.paymentMethod,
    this.vendorName,
    this.receiptUrl,
  });

  final String id;
  final String expenseNo;
  final String date;
  final String category;
  final String description;
  final double amount;
  final String status;
  final String paymentMethod;
  final String? vendorName;
  final String? receiptUrl;
}
