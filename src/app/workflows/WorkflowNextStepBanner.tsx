/**
 * Shows the next step in the business-type workflow (e.g. "Next: Payment" after a sale).
 * Used on Sale detail, Rental detail, etc. to guide the user.
 * Uses app navigation (setCurrentView), not URL routes.
 */
import React from 'react';
import { ChevronRight, ArrowRight } from 'lucide-react';
import { getNextWorkflowStep, getWorkflowForBusinessType } from './businessTypeWorkflows';
import { useSettings } from '@/app/context/SettingsContext';
import { useNavigation } from '@/app/context/NavigationContext';

interface WorkflowNextStepBannerProps {
  /** Current step id in the workflow (e.g. 'sale', 'payment', 'booking') */
  currentStepId: string;
  /** Optional: override business type; otherwise from settings.company.businessType */
  businessType?: string | null;
  /** Optional: compact style for inline use */
  compact?: boolean;
  className?: string;
}

/** Map workflow route to app navigation view */
const ROUTE_TO_VIEW: Record<string, string> = {
  '/sales': 'sales',
  '/purchases': 'purchases',
  '/rentals': 'rentals',
  '/studio': 'studio',
  '/inventory': 'inventory',
};

export function WorkflowNextStepBanner({
  currentStepId,
  businessType: businessTypeProp,
  compact = false,
  className = '',
}: WorkflowNextStepBannerProps) {
  const { company } = useSettings();
  const { setCurrentView } = useNavigation();
  const businessType = businessTypeProp ?? company.businessType;
  const nextStep = getNextWorkflowStep(businessType, currentStepId);

  if (!nextStep) return null;

  const view = nextStep.route ? ROUTE_TO_VIEW[nextStep.route] : null;
  const handleClick = view ? () => setCurrentView(view as any) : undefined;

  const content = (
    <>
      <span className="text-gray-400 text-xs uppercase tracking-wider">Next</span>
      <span className="font-medium text-white">{nextStep.label}</span>
      {nextStep.route && (
        compact ? <ChevronRight size={14} className="text-gray-500" /> : <ArrowRight size={14} className="text-blue-400" />
      )}
    </>
  );

  const baseClass = compact
    ? 'inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-800/80 text-sm'
    : 'flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/90 border border-gray-700 text-sm';

  if (handleClick) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`${baseClass} hover:bg-gray-700/90 hover:border-gray-600 transition-colors cursor-pointer ${className}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`${baseClass} ${className}`}>
      {content}
    </div>
  );
}

/**
 * Renders the full workflow as a small step indicator (e.g. Sale → Payment → Receipt).
 */
export function WorkflowStepsIndicator({
  currentStepId,
  businessType: businessTypeProp,
  className = '',
}: {
  currentStepId: string;
  businessType?: string | null;
  className?: string;
}) {
  const { company } = useSettings();
  const businessType = businessTypeProp ?? company.businessType;
  const workflow = getWorkflowForBusinessType(businessType);
  const currentIdx = workflow.steps.findIndex((s) => s.id === currentStepId);

  if (workflow.steps.length === 0) return null;

  return (
    <div className={`flex items-center gap-1 flex-wrap text-xs text-gray-500 ${className}`}>
      {workflow.steps.map((step, i) => {
        const isCurrent = step.id === currentStepId;
        const isPast = currentIdx >= 0 && i < currentIdx;
        return (
          <React.Fragment key={step.id}>
            {i > 0 && <span className="text-gray-600">→</span>}
            <span
              className={
                isCurrent
                  ? 'text-blue-400 font-medium'
                  : isPast
                    ? 'text-gray-400 line-through'
                    : 'text-gray-500'
              }
            >
              {step.label}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}
