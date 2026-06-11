import type { User } from '../../types';
import { StaffStatementReport } from './reports/StaffStatementReport';

interface MyFinancialActivityProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branchId?: string | null;
  reportRefreshEpoch?: number;
}

/** Salary + commission statement for the signed-in user (read-only). */
export function MyFinancialActivity({
  onBack,
  user,
  companyId,
  branchId,
  reportRefreshEpoch = 0,
}: MyFinancialActivityProps) {
  return (
    <StaffStatementReport
      onBack={onBack}
      companyId={companyId}
      branchId={branchId}
      user={user}
      reportRefreshEpoch={reportRefreshEpoch}
      initialUserId={user.profileId || user.id}
      readOnlySelf
    />
  );
}
