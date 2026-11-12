import { Check } from 'lucide-react';
import {
  getRentalWorkflowSteps,
  type RentalWorkflowStep,
} from '../../lib/rentalWorkflowDisplay';

interface RentalWorkflowBadgesProps {
  status: string;
  due: number;
  /** Show compact chips on list cards; default false uses slightly larger padding on detail. */
  compact?: boolean;
  className?: string;
}

function stepClass(step: RentalWorkflowStep, compact: boolean): string {
  const base = compact
    ? 'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border'
    : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium border';

  if (step.state === 'done') {
    if (step.key === 'complete') {
      return `${base} bg-emerald-500/25 text-emerald-300 border-emerald-500/40`;
    }
    return `${base} bg-green-500/20 text-green-400/90 border-green-500/30`;
  }
  if (step.state === 'current') {
    if (step.key === 'booked') return `${base} bg-pink-500/25 text-pink-300 border-pink-500/40`;
    if (step.key === 'pickup') return `${base} bg-blue-500/25 text-blue-300 border-blue-500/40`;
    if (step.key === 'returned') return `${base} bg-green-500/25 text-green-300 border-green-500/40`;
    if (step.key === 'complete') return `${base} bg-emerald-500/25 text-emerald-300 border-emerald-500/40`;
  }
  return `${base} bg-[#374151]/60 text-[#6B7280] border-[#374151]`;
}

export function RentalWorkflowBadges({ status, due, compact = false, className = '' }: RentalWorkflowBadgesProps) {
  const steps = getRentalWorkflowSteps({ status, due });
  const showOverdue = status === 'overdue';

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {steps.map((step) => (
        <span key={step.key} className={stepClass(step, compact)}>
          {step.key === 'complete' && step.state === 'done' ? (
            <Check className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
          ) : null}
          {step.label}
        </span>
      ))}
      {showOverdue && (
        <span
          className={
            compact
              ? 'inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30'
              : 'inline-flex px-2 py-0.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30'
          }
        >
          Overdue
        </span>
      )}
    </div>
  );
}
