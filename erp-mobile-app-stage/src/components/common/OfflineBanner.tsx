interface OfflineBannerProps {
  online: boolean;
  cachedAt?: number | null;
  pendingCount?: number;
  className?: string;
}

function formatCachedAt(ts: number | null | undefined): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('en-PK', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function OfflineBanner({ online, cachedAt, pendingCount = 0, className = '' }: OfflineBannerProps) {
  if (online) return null;
  const saved = formatCachedAt(cachedAt);
  return (
    <div
      className={`mx-0 mb-3 rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-100 ${className}`}
      role="status"
    >
      <p className="font-medium">Offline mode</p>
      <p className="text-amber-200/80 mt-0.5">
        {saved ? `Showing last saved data (${saved}).` : 'Showing saved data where available.'}
        {pendingCount > 0 ? ` ${pendingCount} item(s) waiting to sync.` : ' New saves are queued until you reconnect.'}
      </p>
    </div>
  );
}
