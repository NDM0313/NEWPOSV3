import { Paperclip } from 'lucide-react';

export interface AttachmentIndicatorButtonProps {
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  size?: 'sm' | 'md';
  /** When true, icon is visible but not interactive (e.g. loading). */
  disabled?: boolean;
}

/**
 * Renders as a span (role=button), not &lt;button&gt;, so it can safely nest
 * inside clickable ledger/timeline rows without validateDOMNesting warnings.
 */
export function AttachmentIndicatorButton({
  onClick,
  className = '',
  size = 'md',
  disabled = false,
}: AttachmentIndicatorButtonProps) {
  const iconClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const stopTouch = (e: React.TouchEvent) => {
    e.stopPropagation();
  };

  const fire = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onClick(e as unknown as React.MouseEvent);
  };

  return (
    <span
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label="View attachments"
      onTouchStart={stopTouch}
      onTouchEnd={(e) => {
        e.stopPropagation();
        if (!disabled) {
          e.preventDefault();
          fire(e);
        }
      }}
      onClick={(e) => fire(e)}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fire(e);
        }
      }}
      className={`inline-flex p-2 rounded-lg text-[#3B82F6] hover:bg-[#374151] shrink-0 cursor-pointer ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      } ${className}`}
    >
      <Paperclip className={iconClass} />
    </span>
  );
}
