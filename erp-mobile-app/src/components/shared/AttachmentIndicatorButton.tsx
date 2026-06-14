import { Paperclip } from 'lucide-react';

export interface AttachmentIndicatorButtonProps {
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  size?: 'sm' | 'md';
  /** When true, icon is visible but not interactive (e.g. loading). */
  disabled?: boolean;
}

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

  return (
    <button
      type="button"
      disabled={disabled}
      onTouchStart={stopTouch}
      onTouchEnd={(e) => {
        e.stopPropagation();
        if (!disabled) {
          e.preventDefault();
          onClick(e as unknown as React.MouseEvent);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick(e);
      }}
      className={`p-2 rounded-lg text-[#3B82F6] hover:bg-[#374151] shrink-0 disabled:opacity-50 ${className}`}
      aria-label="View attachments"
    >
      <Paperclip className={iconClass} />
    </button>
  );
}
