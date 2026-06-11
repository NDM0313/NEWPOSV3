import { IN_OUT, type LedgerSide } from '../../utils/debitCreditInOutLabels';

export function DebitCreditInOutBadge({ side }: { side: LedgerSide }) {
  const meta = IN_OUT[side];
  const isIn = side === 'debit';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border shrink-0 ${
        isIn ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30' : 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30'
      }`}
    >
      <span aria-hidden>{meta.arrow}</span>
      {meta.badge}
    </span>
  );
}

export function FlowStepHeader({
  title,
  side,
  hint,
}: {
  title: string;
  side: LedgerSide;
  hint?: string;
}) {
  const meta = IN_OUT[side];
  return (
    <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <DebitCreditInOutBadge side={side} />
      </div>
      <p className="text-xs text-[#9CA3AF]">{hint ?? meta.hint}</p>
    </div>
  );
}

export function AccountSideLabelRow({
  title,
  side,
  required,
  hint,
}: {
  title: string;
  side: LedgerSide;
  required?: boolean;
  hint?: string;
}) {
  const meta = IN_OUT[side];
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-sm font-medium text-[#9CA3AF]">
          {title}
          {required && <span className="text-[#EF4444]"> *</span>}
        </label>
        <DebitCreditInOutBadge side={side} />
      </div>
      <p className="text-[11px] text-[#6B7280] mt-1">{hint ?? meta.hint}</p>
    </div>
  );
}

export function MoneyFlowSummaryBar({ inLabel, outLabel }: { inLabel: string; outLabel: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[#374151] bg-[#111827]/80 px-3 py-2 text-[11px] mb-3">
      <span className="text-[#10B981] font-semibold whitespace-nowrap">↑ IN</span>
      <span className="text-[#9CA3AF]">{inLabel}</span>
      <span className="text-[#4B5563]">•</span>
      <span className="text-[#EF4444] font-semibold whitespace-nowrap">↓ OUT</span>
      <span className="text-[#9CA3AF]">{outLabel}</span>
    </div>
  );
}
