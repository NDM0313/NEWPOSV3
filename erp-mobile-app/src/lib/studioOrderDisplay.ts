import type { StudioOrder } from '../components/studio/StudioDashboard';
import type { LucideIcon } from 'lucide-react';
import { CheckCircle, Clock, Package, FileCheck } from 'lucide-react';

export type StudioDashboardBadgeKey =
  | 'bill-generated'
  | 'tasks-complete'
  | 'pending'
  | 'in-progress'
  | 'ready'
  | 'completed'
  | 'shipped';

export interface StudioDashboardBadge {
  key: StudioDashboardBadgeKey;
  label: string;
  color: string;
  bg: string;
  icon: LucideIcon;
}

export function allStagesCompleted(order: StudioOrder): boolean {
  return order.stages.length > 0 && order.stages.every((s) => s.status === 'completed');
}

export function isBillGenerated(order: StudioOrder): boolean {
  return order.customerInvoiceGenerated;
}

export function isSaleFinalized(order: StudioOrder): boolean {
  return String(order.saleStatus ?? '').toLowerCase() === 'final';
}

const STATUS_BADGE: Record<
  StudioOrder['status'],
  Omit<StudioDashboardBadge, 'key'> & { key: StudioDashboardBadgeKey }
> = {
  pending: { key: 'pending', label: 'Pending', color: '#F59E0B', bg: 'bg-[#F59E0B]/10', icon: Clock },
  'in-progress': { key: 'in-progress', label: 'In Progress', color: '#3B82F6', bg: 'bg-[#3B82F6]/10', icon: Package },
  ready: { key: 'ready', label: 'Ready', color: '#8B5CF6', bg: 'bg-[#8B5CF6]/10', icon: CheckCircle },
  completed: { key: 'completed', label: 'Completed', color: '#10B981', bg: 'bg-[#10B981]/10', icon: CheckCircle },
  shipped: { key: 'shipped', label: 'Shipped', color: '#6B7280', bg: 'bg-[#6B7280]/10', icon: Package },
};

/** Dashboard pill + status line — bill generated wins over generic completed. */
export function getStudioDashboardBadge(order: StudioOrder): StudioDashboardBadge {
  if (isBillGenerated(order)) {
    return {
      key: 'bill-generated',
      label: 'Bill Generated',
      color: '#10B981',
      bg: 'bg-[#10B981]/10',
      icon: FileCheck,
    };
  }
  if (allStagesCompleted(order)) {
    return {
      key: 'tasks-complete',
      label: 'Tasks Complete',
      color: '#8B5CF6',
      bg: 'bg-[#8B5CF6]/10',
      icon: CheckCircle,
    };
  }
  return STATUS_BADGE[order.status];
}

/** Gray box "Stage:" line on dashboard cards. */
export function resolveStudioCurrentStageLabel(order: StudioOrder): string {
  if (isBillGenerated(order)) return 'Bill Generated';
  if (allStagesCompleted(order)) return 'Ready for Invoice';
  return order.currentStage ?? 'Not Started';
}

/** Header status tile on order detail. */
export function getStudioDetailStatusLabel(order: StudioOrder): string {
  if (isBillGenerated(order)) return 'Bill Generated';
  const badge = getStudioDashboardBadge(order);
  return badge.label;
}
