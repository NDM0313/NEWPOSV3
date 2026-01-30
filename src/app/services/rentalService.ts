import { supabase } from '@/lib/supabase';

export interface Rental {
  id?: string;
  company_id: string;
  branch_id: string;
  booking_no?: string;
  booking_date: string;
  customer_id: string;
  customer_name: string;
  status: 'booked' | 'picked_up' | 'returned' | 'closed' | 'cancelled' | 'overdue';
  pickup_date: string;
  return_date: string;
  actual_return_date?: string;
  duration_days: number;
  rental_charges: number;
  security_deposit: number;
  late_fee?: number;
  damage_charges?: number;
  total_amount: number;
  paid_amount: number;
  refund_amount?: number;
  notes?: string;
  created_by: string;
}

export interface RentalItem {
  id?: string;
  rental_id: string;
  product_id: string;
  variation_id?: string;
  product_name: string;
  quantity: number;
  rate_per_day: number;
  duration_days: number;
  total: number;
  returned_quantity?: number;
  condition_on_return?: 'good' | 'damaged' | 'lost';
  damage_amount?: number;
  notes?: string;
}

export const rentalService = {
  // Create rental with items
  async createRental(rental: Partial<Rental>, items: RentalItem[]) {
    // Insert rental
    const { data: rentalData, error: rentalError } = await supabase
      .from('rentals')
      .insert(rental)
      .select()
      .single();

    if (rentalError) throw rentalError;

    // Insert items
    const itemsWithRentalId = items.map(item => ({
      ...item,
      rental_id: rentalData.id,
    }));

    const { error: itemsError } = await supabase
      .from('rental_items')
      .insert(itemsWithRentalId);

    if (itemsError) {
      // Rollback: Delete rental
      await supabase.from('rentals').delete().eq('id', rentalData.id);
      throw itemsError;
    }

    return rentalData;
  },

  // Get all rentals
  async getAllRentals(companyId: string, branchId?: string) {
    let query = supabase
      .from('rentals')
      .select(`
        *,
        customer:contacts(name, phone),
        items:rental_items(
          *,
          product:products(name, sku)
        )
      `)
      .eq('company_id', companyId)
      .order('booking_date', { ascending: false });

    // Only apply branch_id filter if it's provided and not "all"
    if (branchId && branchId !== 'all') {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Get single rental
  async getRental(id: string) {
    const { data, error } = await supabase
      .from('rentals')
      .select(`
        *,
        customer:contacts(*),
        items:rental_items(
          *,
          product:products(*),
          variation:product_variations(*)
        ),
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Update rental
  async updateRental(id: string, updates: Partial<Rental>) {
    const { data, error } = await supabase
      .from('rentals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete rental (soft delete by setting status to cancelled)
  async deleteRental(id: string) {
    const { error } = await supabase
      .from('rentals')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) throw error;
  },

  // Get rentals by status
  async getRentalsByStatus(companyId: string, status: Rental['status']) {
    const { data, error } = await supabase
      .from('rentals')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', status)
      .order('booking_date', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get rentals by date range
  async getRentalsByDateRange(companyId: string, startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('rentals')
      .select('*')
      .eq('company_id', companyId)
      .gte('pickup_date', startDate)
      .lte('return_date', endDate)
      .order('pickup_date');

    if (error) throw error;
    return data;
  },

  // Update rental items
  async updateRentalItems(rentalId: string, items: RentalItem[]) {
    // Delete existing items
    await supabase.from('rental_items').delete().eq('rental_id', rentalId);

    // Insert new items
    const { error } = await supabase
      .from('rental_items')
      .insert(items.map(item => ({ ...item, rental_id: rentalId })));

    if (error) throw error;
  },

  // Process return
  async processReturn(rentalId: string, returnData: {
    actual_return_date: string;
    late_fee?: number;
    damage_charges?: number;
    refund_amount?: number;
    items: Array<{
      id: string;
      returned_quantity: number;
      condition_on_return?: 'good' | 'damaged' | 'lost';
      damage_amount?: number;
    }>;
  }) {
    // Update rental
    await supabase
      .from('rentals')
      .update({
        actual_return_date: returnData.actual_return_date,
        late_fee: returnData.late_fee || 0,
        damage_charges: returnData.damage_charges || 0,
        refund_amount: returnData.refund_amount || 0,
        status: 'returned',
      })
      .eq('id', rentalId);

    // Update items
    for (const item of returnData.items) {
      await supabase
        .from('rental_items')
        .update({
          returned_quantity: item.returned_quantity,
          condition_on_return: item.condition_on_return,
          damage_amount: item.damage_amount || 0,
        })
        .eq('id', item.id);
    }
  },
};
