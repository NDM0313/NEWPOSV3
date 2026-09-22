import { formatAmount } from './format';
import { ReportCard, ReportSectionTitle } from './ReportShell';
import { makeInitialRange, type DateRangeValue } from './DateRangeBar';

const OPENING_EPS = 0.005;

/** True when period has a carried opening but no in-range movements. */
export function isOpeningOnlyPeriod(linesLength: number, opening: number): boolean {
  return linesLength === 0 && Math.abs(opening) >= OPENING_EPS;
}

/** True empty: no lines and negligible opening. */
export function isTrulyEmptyLedger(linesLength: number, opening: number): boolean {
  return linesLength === 0 && Math.abs(opening) < OPENING_EPS;
}

export function LedgerPeriodEmptyCard({
  opening,
  periodLabel,
  onShowAllTime,
}: {
  opening: number;
  periodLabel: string;
  onShowAllTime: () => void;
}) {
  return (
    <ReportCard>
      <ReportSectionTitle title="Ledger activity" subtitle={periodLabel} right="0 entries" />
      <ul className="divide-y divide-[#374151]">
        <li className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Opening balance</p>
            <p className="text-[11px] text-[#9CA3AF]">Carried into this period</p>
          </div>
          <p className={`text-sm font-bold shrink-0 ${opening >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
            Rs. {formatAmount(opening, 0)}
          </p>
        </li>
      </ul>
      <div className="px-4 py-4 border-t border-[#374151] space-y-3">
        <p className="text-sm text-[#9CA3AF] text-center">
          No movements in this period. Prior activity is reflected in opening balance.
        </p>
        <button
          type="button"
          onClick={onShowAllTime}
          className="w-full py-2.5 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-semibold transition-colors"
        >
          Show all time
        </button>
      </div>
    </ReportCard>
  );
}

export function allTimeDateRange(): DateRangeValue {
  return makeInitialRange('all');
}
