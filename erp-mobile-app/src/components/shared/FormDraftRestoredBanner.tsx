interface FormDraftRestoredBannerProps {
  show: boolean;
  onDismiss: () => void;
}

export function FormDraftRestoredBanner({ show, onDismiss }: FormDraftRestoredBannerProps) {
  if (!show) return null;
  return (
    <div className="mx-3 mt-2 mb-1 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex justify-between items-center gap-2">
      <span>Restored unsaved work</span>
      <button type="button" onClick={onDismiss} className="shrink-0 text-amber-100 underline">
        OK
      </button>
    </div>
  );
}
