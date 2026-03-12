/**
 * Manufacturing: Production Steps. Per order: step name, worker, cost, status.
 */
import { supabase } from '@/lib/supabase';

export type ProductionStepStatus = 'pending' | 'in_progress' | 'completed';

export interface ProductionStepRow {
  id: string;
  production_order_id: string;
  step_name: string;
  sort_order: number;
  worker_id: string | null;
  cost: number;
  status: ProductionStepStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_STEP_NAMES = ['Cutting', 'Dyeing', 'Stitching', 'Handwork', 'Finishing'] as const;

export const productionStepService = {
  async listByOrder(productionOrderId: string): Promise<ProductionStepRow[]> {
    const { data, error } = await supabase
      .from('production_steps')
      .select('*')
      .eq('production_order_id', productionOrderId)
      .order('sort_order')
      .order('created_at');
    if (error) throw error;
    return (data || []) as ProductionStepRow[];
  },

  async getById(id: string): Promise<ProductionStepRow | null> {
    const { data, error } = await supabase
      .from('production_steps')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as ProductionStepRow | null;
  },

  async create(payload: {
    production_order_id: string;
    step_name: string;
    sort_order?: number;
    worker_id?: string | null;
    cost?: number;
    status?: ProductionStepStatus;
  }): Promise<ProductionStepRow> {
    const { data, error } = await supabase
      .from('production_steps')
      .insert({
        production_order_id: payload.production_order_id,
        step_name: payload.step_name,
        sort_order: payload.sort_order ?? 0,
        worker_id: payload.worker_id ?? null,
        cost: payload.cost ?? 0,
        status: payload.status ?? 'pending',
      })
      .select()
      .single();
    if (error) throw error;
    return data as ProductionStepRow;
  },

  async createStepsForOrder(
    productionOrderId: string,
    stepNames: string[] = [...DEFAULT_STEP_NAMES]
  ): Promise<ProductionStepRow[]> {
    const created: ProductionStepRow[] = [];
    for (let i = 0; i < stepNames.length; i++) {
      const row = await this.create({
        production_order_id: productionOrderId,
        step_name: stepNames[i],
        sort_order: i,
      });
      created.push(row);
    }
    return created;
  },

  async update(
    id: string,
    updates: {
      step_name?: string;
      sort_order?: number;
      worker_id?: string | null;
      cost?: number;
      status?: ProductionStepStatus;
      completed_at?: string | null;
    }
  ): Promise<ProductionStepRow> {
    const { data, error } = await supabase
      .from('production_steps')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as ProductionStepRow;
  },

  async setCompleted(id: string, cost?: number): Promise<ProductionStepRow> {
    return this.update(id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      ...(cost !== undefined && { cost }),
    });
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('production_steps').delete().eq('id', id);
    if (error) throw error;
  },
};
