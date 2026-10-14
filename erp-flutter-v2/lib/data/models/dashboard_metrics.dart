class DashboardMetrics {
  const DashboardMetrics({
    this.todaySales = 0,
    this.todayProfit = 0,
    this.monthlyRevenue = 0,
    this.monthlyExpenses = 0,
    this.monthlyProfit = 0,
    this.cashBalance = 0,
    this.bankBalance = 0,
    this.receivables = 0,
    this.payables = 0,
    this.ordersCount = 0,
    this.workerRevenue = 0,
    this.workerProfit = 0,
    this.isWorkerScoped = false,
    this.errorMessage,
  });

  final double todaySales;
  final double todayProfit;
  final double monthlyRevenue;
  final double monthlyExpenses;
  final double monthlyProfit;
  final double cashBalance;
  final double bankBalance;
  final double receivables;
  final double payables;
  final int ordersCount;
  final double workerRevenue;
  final double workerProfit;
  final bool isWorkerScoped;
  final String? errorMessage;
}

class LowStockItem {
  const LowStockItem({
    required this.id,
    required this.name,
    required this.currentStock,
    required this.minStock,
    this.sku,
  });

  final String id;
  final String name;
  final double currentStock;
  final double minStock;
  final String? sku;
}
