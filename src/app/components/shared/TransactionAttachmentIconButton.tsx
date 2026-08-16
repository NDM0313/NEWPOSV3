import React from 'react';
import { Paperclip } from 'lucide-react';

export interface TransactionAttachmentIconButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

/** Amber paperclip — matches Accounting Dashboard attachment affordance. */
export function TransactionAttachmentIconButton({
  onClick,
  disabled,
}: TransactionAttachmentIconButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onClick();
      }}
      className="text-amber-400 hover:text-amber-300 disabled:opacity-40 shrink-0 mt-0.5"
      title="View attachment"
      aria-label="View attachment"
    >
      <Paperclip size={14} />
    </button>
  );
}
