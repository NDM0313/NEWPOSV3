import { COURIER_STATUS_STEPS, statusLabel } from '../../lib/shipmentStatus';

interface ShipmentStatusStepperProps {
  status: string;
  onAdvance?: (nextStatus: string) => void;
  disabled?: boolean;
}

export function ShipmentStatusStepper({ status, onAdvance, disabled }: ShipmentStatusStepperProps) {
  const norm = status.toLowerCase().replace(/\s+/g, '_');
  const currentIdx = COURIER_STATUS_STEPS.findIndex((s) => s.key === norm);

  return (
    <div className="flex flex-wrap gap-2">
      {COURIER_STATUS_STEPS.map((step, idx) => {
        const active = currentIdx >= 0 ? idx <= currentIdx : step.key === 'booked';
        const isCurrent = step.key === norm;
        return (
          <button
            key={step.key}
            type="button"
            disabled={disabled || !onAdvance}
            onClick={() => {
              if (!onAdvance || isCurrent) return;
              onAdvance(step.key);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              isCurrent
                ? 'bg-[#0EA5E9] border-[#0EA5E9] text-white'
                : active
                  ? 'bg-[#0EA5E9]/20 border-[#0EA5E9]/40 text-[#7DD3FC]'
                  : 'bg-[#111827] border-[#374151] text-[#6B7280]'
            }`}
          >
            {step.label}
          </button>
        );
      })}
      {currentIdx < 0 && (
        <span className="text-xs text-[#9CA3AF] self-center capitalize">{statusLabel(status)}</span>
      )}
    </div>
  );
}
