interface SaveBlockingOverlayProps {
  active?: boolean;
  label?: string;
}

/**
 * Blocks pointer events on a relative/fixed parent while a save is in flight.
 * Prefer `useSubmitLock().run()` for the global overlay; use this inside sheets
 * when the parent container must block locally (e.g. below z-[9999] siblings).
 */
export function SaveBlockingOverlay({ active, label = 'Saving...' }: SaveBlockingOverlayProps) {
  if (!active) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="absolute inset-0 z-[130] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="flex flex-col items-center gap-2 rounded-xl bg-[#1F2937] border border-[#374151] px-5 py-4 shadow-xl">
        <div
          className="w-8 h-8 rounded-full border-4 border-[#374151] border-t-[#8B5CF6] animate-spin"
          aria-hidden="true"
        />
        <p className="text-sm text-white font-medium">{label}</p>
      </div>
    </div>
  );
}
