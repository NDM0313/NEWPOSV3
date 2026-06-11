import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Loader2, Search, Users } from 'lucide-react';
import type { User } from '../../../types';
import { getUsersForSalary } from '../../../api/users';
import { getStaffStatement, type StaffStatementRow } from '../../../api/staffStatement';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell, ReportCard, ReportSectionTitle } from './_shared/ReportShell';
import { formatAmount, dateRangeLabel } from './_shared/format';

interface StaffStatementReportProps {
  onBack: () => void;
  companyId: string | null;
  branchId?: string | null;
  user: User;
  reportRefreshEpoch?: number;
  /** When set, open directly on this user (e.g. salesman viewing own statement). */
  initialUserId?: string | null;
  readOnlySelf?: boolean;
}

function kindLabel(kind: StaffStatementRow['kind']): string {
  if (kind === 'salary') return 'Salary';
  if (kind === 'commission_earned') return 'Commission';
  return 'Comm. paid';
}

function kindColor(kind: StaffStatementRow['kind']): string {
  if (kind === 'salary') return 'text-purple-300';
  if (kind === 'commission_earned') return 'text-emerald-300';
  return 'text-sky-300';
}

export function StaffStatementReport({
  onBack,
  companyId,
  user,
  reportRefreshEpoch = 0,
  initialUserId = null,
  readOnlySelf = false,
}: StaffStatementReportProps) {
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingList, setLoadingList] = useState(!!companyId);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(initialUserId);
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange('month'));
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementError, setStatementError] = useState<string | null>(null);
  const [rows, setRows] = useState<StaffStatementRow[]>([]);
  const [summary, setSummary] = useState({
    salaryPaid: 0,
    commissionEarned: 0,
    commissionPaid: 0,
    netOwedToUser: 0,
    closingBalance: 0,
  });

  useEffect(() => {
    if (!companyId) {
      setLoadingList(false);
      return;
    }
    if (readOnlySelf && (user.profileId || user.id)) {
      setStaff([{ id: user.profileId || user.id, name: user.name || 'Me' }]);
      setSelectedId(user.profileId || user.id);
      setLoadingList(false);
      return;
    }
    setLoadingList(true);
    getUsersForSalary(companyId).then(({ data }) => {
      setStaff((data || []).map((u) => ({ id: u.id, name: u.full_name || u.email || u.id })));
      setLoadingList(false);
    });
  }, [companyId, readOnlySelf, user.id, user.profileId, user.name]);

  useEffect(() => {
    if (initialUserId) setSelectedId(initialUserId);
  }, [initialUserId]);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) => s.name.toLowerCase().includes(q));
  }, [staff, search]);

  const selectedName = staff.find((s) => s.id === selectedId)?.name || user.name || 'Staff';

  const loadStatement = useCallback(async () => {
    if (!companyId || !selectedId) return;
    setStatementLoading(true);
    setStatementError(null);
    const { data, error } = await getStaffStatement(companyId, selectedId, range.from, range.to);
    if (error) {
      setStatementError(error);
      setRows([]);
    } else if (data) {
      setRows(data.rows);
      setSummary({
        salaryPaid: data.salaryPaid,
        commissionEarned: data.commissionEarned,
        commissionPaid: data.commissionPaid,
        netOwedToUser: data.netOwedToUser,
        closingBalance: data.closingBalance,
      });
    }
    setStatementLoading(false);
  }, [companyId, selectedId, range.from, range.to]);

  useEffect(() => {
    if (selectedId) loadStatement();
  }, [selectedId, loadStatement, reportRefreshEpoch]);

  if (!selectedId && !readOnlySelf) {
    return (
      <ReportShell>
        <ReportHeader title="Staff statement" subtitle="Salary + commission by user" onBack={onBack} gradient="indigo" />
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff…"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#1F2937] border border-[#374151] text-white"
            />
          </div>
          {loadingList ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#8B5CF6]" />
            </div>
          ) : (
            filteredStaff.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-[#1F2937] border border-[#374151] text-left"
              >
                <span className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-[#8B5CF6]" />
                  <span className="text-white font-medium">{s.name}</span>
                </span>
                <ChevronRight className="w-5 h-5 text-[#6B7280]" />
              </button>
            ))
          )}
        </div>
      </ReportShell>
    );
  }

  return (
    <ReportShell>
      <ReportHeader
        title={readOnlySelf ? 'My salary & commission' : 'Staff statement'}
        subtitle={selectedName}
        onBack={() => (readOnlySelf ? onBack() : setSelectedId(null))}
        gradient="indigo"
      />
      <div className="p-4 space-y-4">
        <DateRangeBar value={range} onChange={setRange} />
        <p className="text-xs text-[#9CA3AF]">{dateRangeLabel(range.from, range.to)} · read-only operational view</p>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['Salary paid', summary.salaryPaid],
              ['Commission', summary.commissionEarned],
              ['Comm. paid', summary.commissionPaid],
              ['Net owed', summary.netOwedToUser],
            ] as const
          ).map(([label, val]) => (
            <ReportCard key={label}>
              <p className="text-[10px] uppercase text-[#9CA3AF]">{label}</p>
              <p className={`text-lg font-bold tabular-nums ${label === 'Net owed' && val > 0 ? 'text-amber-300' : 'text-white'}`}>
                {formatAmount(val)}
              </p>
            </ReportCard>
          ))}
        </div>

        {statementLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-7 h-7 animate-spin text-[#8B5CF6]" />
          </div>
        ) : statementError ? (
          <p className="text-sm text-[#EF4444]">{statementError}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[#9CA3AF] text-center py-8">No rows in this period.</p>
        ) : (
          <div className="space-y-2">
            <ReportSectionTitle title="Activity" />
            {rows.map((r) => (
              <div key={`${r.kind}-${r.id}-${r.date}`} className="p-3 rounded-xl bg-[#1F2937] border border-[#374151]">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-xs font-medium ${kindColor(r.kind)}`}>{kindLabel(r.kind)}</p>
                    <p className="text-sm text-white truncate">{r.description}</p>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      {r.date} · {r.referenceNo}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {r.debit > 0 ? (
                      <p className="text-sm font-semibold text-white tabular-nums">Dr {formatAmount(r.debit)}</p>
                    ) : (
                      <p className="text-sm font-semibold text-emerald-300 tabular-nums">Cr {formatAmount(r.credit)}</p>
                    )}
                    <p className="text-[10px] text-[#6B7280] tabular-nums">Bal {formatAmount(r.runningBalance)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ReportShell>
  );
}
