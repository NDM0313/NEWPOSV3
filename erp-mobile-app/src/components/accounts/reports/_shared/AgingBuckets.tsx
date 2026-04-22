export interface AgingBucket {
  label: string;
  amount: number;
  count: number;
  color?: string;
}

export interface AgingBucketsProps {
  buckets: AgingBucket[];
  grandTotal: number;
  currency?: string;
}

const DEFAULT_COLORS = ['#10B981', '#F59E0B', '#F97316', '#EF4444', '#DC2626'];

function fmt(n: number): string {
  return n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export const DEFAULT_AGING_LABELS = ['0-30', '31-60', '61-90', '91-180', '180+'] as const;

/** Aging bucket bar + breakdown cards. */
export function AgingBuckets({ buckets, grandTotal, currency = 'Rs.' }: AgingBucketsProps) {
  const total = grandTotal || buckets.reduce((s, b) => s + b.amount, 0) || 1;
  return (
    <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Aging breakdown</h3>
        <div className="text-right">
          <p className="text-[10px] text-[#9CA3AF] uppercase">Grand total</p>
          <p className="text-sm font-bold text-white">
            {currency} {fmt(grandTotal)}
          </p>
        </div>
      </div>

      <div className="flex h-2.5 rounded-full overflow-hidden bg-[#111827] mb-3">
        {buckets.map((b, i) => {
          const pct = (b.amount / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={b.label}
              className="h-full"
              style={{ width: `${pct}%`, backgroundColor: b.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length] }}
              title={`${b.label}: ${currency} ${fmt(b.amount)}`}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-5 gap-2">
        {buckets.map((b, i) => {
          const color = b.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
          return (
            <div key={b.label} className="bg-[#111827] rounded-lg px-2 py-2 text-center">
              <div className="h-1 rounded-full mb-1.5" style={{ backgroundColor: color }} />
              <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide">{b.label}</p>
              <p className="text-xs font-semibold text-white mt-0.5">{fmt(b.amount)}</p>
              <p className="text-[10px] text-[#6B7280]">{b.count}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
