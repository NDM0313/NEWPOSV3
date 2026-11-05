import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { saleService } from '@/app/services/saleService';
import { convertFromSupabaseSale, type Sale } from '@/app/context/SalesContext';

/**
 * After a bespoke work order completes, remind the user that sale Final is still manual.
 * Does not change sale status — only offers navigation into Convert to Final.
 */
export async function nudgeConvertSaleToFinalAfterWoComplete(opts: {
  saleId: string;
  knownStatus?: string | null;
  openConvert: (sale: Sale) => void;
}): Promise<void> {
  let status = opts.knownStatus;
  if (!status) {
    const { data } = await supabase
      .from('sales')
      .select('status')
      .eq('id', opts.saleId)
      .maybeSingle();
    status = (data as { status?: string } | null)?.status ?? null;
  }
  if (String(status ?? '').toLowerCase() !== 'order') return;

  toast.message('Work order complete — sale is still an Order.', {
    description: 'Convert to Final when ready to post the invoice (not automatic).',
    duration: 12000,
    action: {
      label: 'Convert to Final',
      onClick: () => {
        void (async () => {
          try {
            const full = await saleService.getSaleById(opts.saleId);
            if ((full as { hasReturn?: boolean })?.hasReturn) {
              toast.error('Cannot convert: this sale has a return and is locked.');
              return;
            }
            opts.openConvert(convertFromSupabaseSale(full));
          } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Could not open sale for Convert to Final');
          }
        })();
      },
    },
  });
}
