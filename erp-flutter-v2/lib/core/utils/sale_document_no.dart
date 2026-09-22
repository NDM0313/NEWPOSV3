String readSaleDocumentNo(Map<String, dynamic> row) {
  final invoice = row['invoice_no']?.toString().trim();
  if (invoice != null && invoice.isNotEmpty) return invoice;

  final order = row['order_no']?.toString().trim();
  if (order != null && order.isNotEmpty) return order;

  final draft = row['draft_no']?.toString().trim();
  if (draft != null && draft.isNotEmpty) return draft;

  final id = row['id']?.toString() ?? '';
  if (id.length >= 8) return 'SALE-${id.substring(0, 8)}';
  return id.isNotEmpty ? id : '—';
}

String readPurchaseDocumentNo(Map<String, dynamic> row) {
  final po = row['po_no']?.toString().trim();
  if (po != null && po.isNotEmpty) return po;

  final order = row['order_no']?.toString().trim();
  if (order != null && order.isNotEmpty) return order;

  final draft = row['draft_no']?.toString().trim();
  if (draft != null && draft.isNotEmpty) return draft;

  final id = row['id']?.toString() ?? '';
  if (id.length >= 8) return 'PUR-${id.substring(0, 8)}';
  return id.isNotEmpty ? id : '—';
}
