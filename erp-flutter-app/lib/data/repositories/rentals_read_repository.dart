import '../../core/supabase/supabase_bootstrap.dart';
import '../../core/utils/branch_id.dart';

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

  double _num(dynamic v) =>
      v == null ? 0 : (num.tryParse(v.toString()) ?? 0).toDouble();
}
