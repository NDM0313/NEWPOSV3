/**
 * ActionBar – Fixed bottom bar for primary actions (Next, Save, etc.)
 * Sits above BottomNav so both remain visible and tappable.
 * Use on screens where BottomNav is shown (Sales, Purchase, Expense flows).
 */
interface ActionBarProps {
  children: React.ReactNode;
  /** When true, bar sits above BottomNav. Default true for mobile flows. */
  aboveNav?: boolean;
  className?: string;
}

export function ActionBar({ children, aboveNav = true, className = '' }: ActionBarProps) {
  return (
    <div
      className={`fixed left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 safe-area-bottom z-40 ${aboveNav ? 'action-bar-above-nav' : 'bottom-0'} ${className}`}
    >
      {children}
    </div>
  );
}
