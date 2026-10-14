import '../../core/supabase/supabase_bootstrap.dart';
import '../../core/utils/branch_id.dart';
import '../../core/utils/local_date.dart';
import 'rental_booking_accounting.dart';

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
  RentalsWriteRepository({RentalBookingAccounting? accounting})
      : _accounting = accounting ?? RentalBookingAccounting();

  final _client = SupabaseBootstrap.client;
  final RentalBookingAccounting _accounting;

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

    final subEnsure = await _accounting.ensurePartySubledgers(customerId);
    if (!subEnsure.success) {
      return (
        rentalId: null,
        bookingNo: null,
        error: subEnsure.error ?? 'Could not set up customer AR sub-account.',
      );
    }

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

      final rentalId = raw['rental_id'].toString();
      final bookingNo = raw['booking_no']?.toString();

      if (rentalCharges > 0) {
        final rev = await _accounting.postRentalPartyRevenueJournal(
          companyId: companyId,
          branchId: branch,
          rentalId: rentalId,
          customerId: customerId,
          customerName: customerName.trim().isEmpty ? 'Customer' : customerName.trim(),
          rentalCharges: rentalCharges,
          entryDate: today,
          userId: createdBy,
        );
        if (rev.error != null) {
          return (rentalId: null, bookingNo: null, error: rev.error);
        }
      }

      return (
        rentalId: rentalId,
        bookingNo: bookingNo,
        error: null,
      );
    } catch (e) {
      return (rentalId: null, bookingNo: null, error: e.toString());
    }
  }

  Future<({bool success, String? error})> recordRentalPayment({
    required String companyId,
    required String branchId,
    required String rentalId,
    required double amount,
    required String createdBy,
  }) async {
    if (amount <= 0) {
      return (success: false, error: 'Amount must be greater than zero.');
    }

    final branch = safeRpcBranchId(branchId);
    if (branch == null) {
      return (success: false, error: 'Invalid branch for payment.');
    }

    try {
      final accountRow = await _client
          .from('accounts')
          .select('id')
          .eq('company_id', companyId)
          .inFilter('type', ['cash', 'bank'])
          .limit(1)
          .maybeSingle();

      final accountId = accountRow?['id']?.toString();
      if (accountId == null) {
        return (success: false, error: 'No cash/bank account found for payments.');
      }

      final raw = await _client.rpc(
        'record_payment_with_accounting',
        params: {
          'p_company_id': companyId,
          'p_branch_id': branch,
          'p_payment_type': 'received',
          'p_reference_type': 'rental',
          'p_reference_id': rentalId,
          'p_amount': amount,
          'p_payment_method': 'cash',
          'p_payment_date': localTodayIso(),
          'p_payment_account_id': accountId,
          'p_reference_number': null,
          'p_notes': 'Flutter ERP rental payment',
          'p_created_by': createdBy,
          'p_worker_stage_id': null,
        },
      );

      if (raw is Map) {
        final res = Map<String, dynamic>.from(raw);
        if (res['success'] == true && res['payment_id'] != null) {
          final journalEntryId = res['journal_entry_id']?.toString();
          final rpRow = await _client
              .from('rental_payments')
              .insert({
                'rental_id': rentalId,
                'amount': amount,
                'method': 'cash',
                'payment_date': localTodayIso(),
                'payment_type': 'remaining',
                'payment_account_id': accountId,
                'created_by': createdBy,
              })
              .select('id')
              .single();

          final rentalPaymentId = Map<String, dynamic>.from(rpRow)['id']?.toString();
          if (journalEntryId != null &&
              journalEntryId.isNotEmpty &&
              rentalPaymentId != null &&
              rentalPaymentId.isNotEmpty) {
            await _accounting.linkRentalPaymentJournalEntry(rentalPaymentId, journalEntryId);
          }
          return (success: true, error: null);
        }
        return (
          success: false,
          error: res['error']?.toString() ?? 'Payment failed.',
        );
      }
      return (success: true, error: null);
    } catch (e) {
      return (success: false, error: e.toString());
    }
  }

  Future<({bool success, String? error})> markRentalPickedUp({
    required String companyId,
    required String rentalId,
    required String userId,
    String? notes,
  }) async {
    try {
      final rental = await _client
          .from('rentals')
          .select('id, status, branch_id, notes')
          .eq('id', rentalId)
          .maybeSingle();

      if (rental == null) {
        return (success: false, error: 'Rental not found.');
      }
      final map = Map<String, dynamic>.from(rental);
      if (map['status']?.toString() != 'booked') {
        return (success: false, error: 'Only booked rentals can be marked picked up.');
      }

      final items = await _client
          .from('rental_items')
          .select('product_id, quantity')
          .eq('rental_id', rentalId);

      for (final row in items as List) {
        final item = Map<String, dynamic>.from(row as Map);
        await _client.from('stock_movements').insert({
          'company_id': companyId,
          'branch_id': map['branch_id'],
          'product_id': item['product_id'],
          'movement_type': 'rental_out',
          'quantity': -(item['quantity'] as num).toDouble(),
          'unit_cost': 0,
          'total_cost': 0,
          'reference_type': 'rental',
          'reference_id': rentalId,
          'created_by': userId,
        });
      }

      await _client.from('rentals').update({
        'status': 'picked_up',
        'notes': notes ?? map['notes'],
        'security_document_type': 'id_card',
        'security_status': 'collected',
      }).eq('id', rentalId);

      return (success: true, error: null);
    } catch (e) {
      return (success: false, error: e.toString());
    }
  }

  Future<({bool success, String? error})> receiveRentalReturn({
    required String companyId,
    required String rentalId,
    required String userId,
    String? notes,
  }) async {
    try {
      final rental = await _client
          .from('rentals')
          .select('id, status, branch_id, due_amount')
          .eq('id', rentalId)
          .maybeSingle();

      if (rental == null) {
        return (success: false, error: 'Rental not found.');
      }
      final map = Map<String, dynamic>.from(rental);
      final status = map['status']?.toString() ?? '';
      if (!['rented', 'overdue', 'picked_up', 'active'].contains(status)) {
        return (success: false, error: 'Mark picked up first, then return when due is cleared.');
      }
      final due = (map['due_amount'] as num?)?.toDouble() ?? 0;
      if (due > 0) {
        return (success: false, error: 'Clear due balance before completing return.');
      }

      final items = await _client
          .from('rental_items')
          .select('product_id, quantity')
          .eq('rental_id', rentalId);

      for (final row in items as List) {
        final item = Map<String, dynamic>.from(row as Map);
        await _client.from('stock_movements').insert({
          'company_id': companyId,
          'branch_id': map['branch_id'],
          'product_id': item['product_id'],
          'movement_type': 'rental_in',
          'quantity': (item['quantity'] as num).toDouble(),
          'unit_cost': 0,
          'total_cost': 0,
          'reference_type': 'rental',
          'reference_id': rentalId,
          'created_by': userId,
        });
      }

      final today = localTodayIso();
      await _client.from('rentals').update({
        'status': 'returned',
        'actual_return_date': today,
        'returned_by': userId,
        'condition_type': 'good',
        'document_returned': true,
        'security_status': 'returned',
        if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      }).eq('id', rentalId);

      return (success: true, error: null);
    } catch (e) {
      return (success: false, error: e.toString());
    }
  }
}
