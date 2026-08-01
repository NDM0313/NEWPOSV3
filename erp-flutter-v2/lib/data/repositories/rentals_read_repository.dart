import '../../core/supabase/supabase_bootstrap.dart';
import '../../core/utils/branch_id.dart';

class RentalLineItem {
  const RentalLineItem({
    required this.productName,
    required this.quantity,
    required this.total,
  });

  final String productName;
  final double quantity;
  final double total;
}

class RentalDetail {
  const RentalDetail({
    required this.id,
    required this.bookingNo,
    required this.customerName,
    required this.status,
    required this.bookingDate,
    required this.pickupDate,
    required this.returnDate,
    required this.total,
    required this.paid,
    required this.due,
    required this.items,
  });

  final String id;
  final String bookingNo;
  final String customerName;
  final String status;
  final String bookingDate;
  final String pickupDate;
  final String returnDate;
  final double total;
  final double paid;
  final double due;
  final List<RentalLineItem> items;
}

class RentalListItem {
  const RentalListItem({
    required this.id,
    required this.bookingNo,
    required this.customerName,
    required this.total,
    required this.paid,
    required this.due,
    required this.status,
    required this.bookingDate,
  });

  final String id;
  final String bookingNo;
  final String customerName;
  final double total;
  final double paid;
  final double due;
  final String status;
  final String bookingDate;
}

class RentalsReadRepository {
  final _client = SupabaseBootstrap.client;

  Future<({List<RentalListItem> rentals, String? error})> getRentals({
    required String companyId,
    String? branchId,
    List<String>? accessibleBranchIds,
  }) async {
    try {
      var query = _client
          .from('rentals')
          .select(
            'id, booking_no, booking_date, customer_name, status, total_amount, paid_amount, due_amount, branch_id',
          )
          .eq('company_id', companyId);

      final branch = safeRpcBranchId(branchId);
      if (branch != null) {
        query = query.eq('branch_id', branch);
      } else if (accessibleBranchIds != null && accessibleBranchIds.isNotEmpty) {
        query = query.inFilter('branch_id', accessibleBranchIds);
      }

      final data = await query
          .order('booking_date', ascending: false)
          .limit(100);

      final rentals = (data as List).map((row) {
        final map = Map<String, dynamic>.from(row as Map);
        final dateRaw = map['booking_date']?.toString() ?? '';
        final no = map['booking_no']?.toString();
        return RentalListItem(
          id: map['id'] as String,
          bookingNo: (no != null && no.isNotEmpty)
              ? no
              : 'RNT-${map['id'].toString().substring(0, 8)}',
          customerName: map['customer_name'] as String? ?? '—',
          total: _num(map['total_amount']),
          paid: _num(map['paid_amount']),
          due: _num(map['due_amount']),
          status: map['status'] as String? ?? '—',
          bookingDate: dateRaw.length >= 10 ? dateRaw.substring(0, 10) : dateRaw,
        );
      }).toList();

      return (rentals: rentals, error: null);
    } catch (e) {
      return (rentals: <RentalListItem>[], error: e.toString());
    }
  }

  Future<({RentalDetail? rental, String? error})> getRentalById({
    required String companyId,
    required String rentalId,
  }) async {
    try {
      final row = await _client
          .from('rentals')
          .select(
            'id, booking_no, booking_date, pickup_date, return_date, customer_name, status, total_amount, paid_amount, due_amount',
          )
          .eq('company_id', companyId)
          .eq('id', rentalId)
          .maybeSingle();

      if (row == null) {
        return (rental: null, error: 'Rental not found.');
      }

      final map = Map<String, dynamic>.from(row);
      final itemsRaw = await _client
          .from('rental_items')
          .select('product_name, quantity, total')
          .eq('rental_id', rentalId);

      final items = (itemsRaw as List).map((r) {
        final m = Map<String, dynamic>.from(r as Map);
        return RentalLineItem(
          productName: m['product_name'] as String? ?? '—',
          quantity: _num(m['quantity']),
          total: _num(m['total']),
        );
      }).toList();

      final bookingRaw = map['booking_date']?.toString() ?? '';
      final pickupRaw = map['pickup_date']?.toString() ?? '';
      final returnRaw = map['return_date']?.toString() ?? '';
      final no = map['booking_no']?.toString();

      return (
        rental: RentalDetail(
          id: map['id'] as String,
          bookingNo: (no != null && no.isNotEmpty)
              ? no
              : 'RNT-${map['id'].toString().substring(0, 8)}',
          customerName: map['customer_name'] as String? ?? '—',
          status: map['status'] as String? ?? '—',
          bookingDate: _ymd(bookingRaw),
          pickupDate: _ymd(pickupRaw),
          returnDate: _ymd(returnRaw),
          total: _num(map['total_amount']),
          paid: _num(map['paid_amount']),
          due: _num(map['due_amount']),
          items: items,
        ),
        error: null,
      );
    } catch (e) {
      return (rental: null, error: e.toString());
    }
  }

  String _ymd(String raw) =>
      raw.length >= 10 ? raw.substring(0, 10) : raw;

  double _num(dynamic v) =>
      v == null ? 0 : (num.tryParse(v.toString()) ?? 0).toDouble();
}
