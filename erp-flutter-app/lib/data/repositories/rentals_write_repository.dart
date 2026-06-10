import '../../core/supabase/supabase_bootstrap.dart';
import '../../core/utils/branch_id.dart';
import '../../core/utils/local_date.dart';

class RentalBookingLineInput {
  const RentalBookingLineInput({
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.ratePerDay,
    required this.durationDays,
    required this.total,
  });

  final String productId;
  final String productName;
  final double quantity;
  final double ratePerDay;
  final int durationDays;
  final double total;
}

class RentalsWriteRepository {
  final _client = SupabaseBootstrap.client;

  Future<({String? rentalId, String? bookingNo, String? error})> createRentalBooking({
    required String companyId,
    required String branchId,
    required String createdBy,
    required String customerId,
    required String customerName,
    required String pickupDate,
    required String returnDate,
    required List<RentalBookingLineInput> items,
    double securityDeposit = 0,
    String? notes,
  }) async {
    if (items.isEmpty) {
      return (rentalId: null, bookingNo: null, error: 'Add at least one rental item.');
    }

    final branch = safeRpcBranchId(branchId);
    if (branch == null) {
      return (
        rentalId: null,
        bookingNo: null,
        error: 'Select a valid branch before creating a rental.',
      );
    }

    final rentalCharges = items.fold<double>(0, (sum, i) => sum + i.total);
    final today = localTodayIso();
    final pickup = pickupDate.length >= 10 ? pickupDate.substring(0, 10) : pickupDate;
    final returnD = returnDate.length >= 10 ? returnDate.substring(0, 10) : returnDate;

    final rentalPayload = <String, dynamic>{
      'booking_date': today,
      'customer_id': customerId,
      'customer_name': customerName.trim().isEmpty ? 'Customer' : customerName.trim(),
      'status': 'booked',
      'pickup_date': pickup,
      'return_date': returnD,
      'rental_charges': rentalCharges,
      'security_deposit': securityDeposit,
      'total_amount': rentalCharges + securityDeposit,
      'paid_amount': 0,
      'due_amount': rentalCharges + securityDeposit,
      'notes': notes,
    };

    final itemsJson = items
        .map(
          (i) => {
            'product_id': i.productId,
            'product_name': i.productName,
            'quantity': i.quantity,
            'rate_per_day': i.ratePerDay,
            'duration_days': i.durationDays,
            'total': i.total,
          },
        )
        .toList();

    try {
      var payload = Map<String, dynamic>.from(rentalPayload);
      var raw = await _client.rpc(
        'create_rental_booking',
        params: {
          'p_company_id': companyId,
          'p_branch_id': branch,
          'p_rental': payload,
          'p_items': itemsJson,
          'p_created_by': createdBy,
        },
      );

      if (raw is Map && raw['success'] == false) {
        return (
          rentalId: null,
          bookingNo: null,
          error: raw['error']?.toString() ?? 'Rental create failed.',
        );
      }

      if (raw is! Map || raw['success'] != true || raw['rental_id'] == null) {
        return (rentalId: null, bookingNo: null, error: 'Invalid rental RPC response.');
      }

      return (
        rentalId: raw['rental_id'].toString(),
        bookingNo: raw['booking_no']?.toString(),
        error: null,
      );
    } catch (e) {
      return (rentalId: null, bookingNo: null, error: e.toString());
    }
  }
}
