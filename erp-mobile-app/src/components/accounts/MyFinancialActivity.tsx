import type { User } from '../../types';
import { TransactionsTimeline } from './reports/TransactionsTimeline';

interface MyFinancialActivityProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branchId?: string | null;
  reportRefreshEpoch?: number;
}

export function MyFinancialActivity({
  onBack,
  user,
  companyId,
  branchId,
  reportRefreshEpoch = 0,
}: MyFinancialActivityProps) {
  return (
    <TransactionsTimeline
      title="My Activity"
      subtitle="Payments and expenses you recorded"
      scopeUser={{ authId: user.id, profileId: user.profileId }}
      includeOwnExpenses
      readOnly
      hideDatePresets={['week', 'quarter', 'year', 'custom']}
      defaultDatePreset="month"
      companyId={companyId}
      branchId={branchId}
      onBack={onBack}
      reportRefreshEpoch={reportRefreshEpoch}
      userName={user.name}
    />
  );
}
