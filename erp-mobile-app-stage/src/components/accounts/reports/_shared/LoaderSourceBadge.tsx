/** Support indicator: unified vs legacy data source (not shown to restricted users on sensitive screens). */

export function LoaderSourceBadge({
  source,
  hidden,
}: {
  source: 'legacy' | 'unified' | 'unavailable';
  hidden?: boolean;
}) {
  if (hidden || source === 'unavailable') return null;
  const label = source === 'unified' ? 'Unified ledger' : 'Legacy';
  const color =
    source === 'unified'
      ? 'bg-[#6366F1]/20 text-[#A5B4FC] border-[#6366F1]/40'
      : 'bg-[#374151] text-[#9CA3AF] border-[#4B5563]';
  return (
    <span className={`inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full border ${color}`}>
      {label}
    </span>
  );
}

export function maskAmount(value: number | string, canView: boolean): string {
  if (!canView) return '****';
  return typeof value === 'number' ? String(value) : value;
}
