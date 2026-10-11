/**
 * MobileActionBar — Consistent bottom action bar across Add Sale, Add Purchase, Cart, Summary.
 * Renders above BottomNav when present (safe area), or at bottom when nav is hidden.
 * Use for: Next Summary, Proceed to Payment, Mark as Final, Save Sale, Continue to Summary.
 */
import { Loader2 } from 'lucide-react';

export interface MobileActionBarProps {
  /** Left label e.g. "Subtotal" or "Total" */
  label?: string;
  /** Right value e.g. "Rs. 1,820" */
  value?: string;
  /** Primary button text */
  buttonLabel: string;
  onButtonClick: () => void;
  /** Disable button (e.g. no items) */
  disabled?: boolean;
  /** Show spinner on button */
  loading?: boolean;
  /** Error message above button */
  error?: string | null;
  /** Button variant style */
  variant?: 'primary' | 'success' | 'danger';
  /** When true, bar sits above BottomNav (default true for flows that show nav). */
  aboveNav?: boolean;
  className?: string;
}

const variantClasses = {
  primary: 'bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#374151] disabled:text-[#6B7280]',
  success: 'bg-[#10B981] hover:bg-[#059669] disabled:bg-[#374151] disabled:text-[#6B7280]',
  danger: 'bg-[#EF4444] hover:bg-[#DC2626] disabled:bg-[#374151] disabled:text-[#6B7280]',
};

export function MobileActionBar({
  label,
  value,
  buttonLabel,
  onButtonClick,
  disabled = false,
  loading = false,
  error,
  variant = 'success',
  aboveNav = true,
  className = '',
}: MobileActionBarProps) {
  return (
    <div
      className={`fixed left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 safe-area-bottom z-40 ${aboveNav ? 'fixed-bottom-above-nav' : 'bottom-0'} ${className}`}
    >
      {(label != null || value != null) && (
        <div className="flex justify-between items-center mb-3">
          {label != null && <span className="text-[#9CA3AF]">{label}</span>}
          {value != null && <span className="text-xl font-bold text-[#10B981]">{value}</span>}
        </div>
      )}
      {error && <p className="text-sm text-red-400 mb-2">{error}</p>}
      <button
        type="button"
        onClick={onButtonClick}
        disabled={disabled || loading}
        className={`w-full h-12 rounded-lg font-medium text-white flex items-center justify-center gap-2 transition-colors ${variantClasses[variant]}`}
      >
        {loading && <Loader2 className="w-5 h-5 animate-spin" />}
        {buttonLabel}
      </button>
    </div>
  );
}
