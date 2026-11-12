import { Loader2 } from 'lucide-react';

export interface ConfirmActionSheetProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  error?: string | null;
  /** When set, user must type this exact phrase; confirm stays disabled until match. */
  requireTypedPhrase?: string | null;
  typedPhrase?: string;
  onTypedPhraseChange?: (value: string) => void;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Mobile confirm sheet for destructive accounting actions (Cancel / Complete Delete).
 * Web parity with TransactionConfirmDialog — no window.confirm.
 */
export function ConfirmActionSheet({
  open,
  title,
  description,
  confirmLabel = 'Yes, continue',
  cancelLabel = 'No',
  busy = false,
  error = null,
  requireTypedPhrase = null,
  typedPhrase = '',
  onTypedPhraseChange,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmActionSheetProps) {
  if (!open) return null;

  const phraseGate = !!requireTypedPhrase;
  const confirmBlocked = busy || confirmDisabled || (phraseGate && typedPhrase.trim() !== requireTypedPhrase);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end md:items-center md:justify-center bg-black/60"
      onClick={() => {
        if (!busy) onCancel();
      }}
      role="presentation"
    >
      <div
        className="w-full md:w-[28rem] bg-[#111827] rounded-t-2xl md:rounded-2xl border border-[#374151] p-5 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-action-title"
      >
        <div>
          <h2 id="confirm-action-title" className="text-base font-semibold text-white">
            {title}
          </h2>
          <p className="mt-2 text-sm text-[#9CA3AF] leading-relaxed whitespace-pre-wrap">{description}</p>
        </div>

        {phraseGate ? (
          <div className="space-y-1.5">
            <label htmlFor="confirm-typed-phrase" className="text-xs font-medium text-[#9CA3AF]">
              Type <span className="text-white font-mono">{requireTypedPhrase}</span> to confirm
            </label>
            <input
              id="confirm-typed-phrase"
              type="text"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={typedPhrase}
              disabled={busy}
              onChange={(e) => onTypedPhraseChange?.(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-[#1F2937] border border-[#4B5563] text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#EF4444]/50 disabled:opacity-50"
              placeholder={requireTypedPhrase || ''}
            />
          </div>
        ) : null}

        {error ? (
          <div className="p-3 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/40 text-sm text-[#FCA5A5]">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="py-3 rounded-lg text-sm font-semibold bg-[#374151] text-white hover:bg-[#4B5563] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={confirmBlocked}
            onClick={onConfirm}
            className="py-3 rounded-lg text-sm font-semibold bg-[#DC2626] text-white hover:bg-[#B91C1C] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
