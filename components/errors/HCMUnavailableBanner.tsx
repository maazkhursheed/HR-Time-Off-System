'use client'

interface HCMUnavailableBannerProps {
  lastSyncedMinutesAgo?: number
  onRetry?: () => void
}

export function HCMUnavailableBanner({ lastSyncedMinutesAgo, onRetry }: HCMUnavailableBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-4 rounded border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
    >
      <p>
        {lastSyncedMinutesAgo !== undefined && lastSyncedMinutesAgo > 15
          ? `Balance data may be outdated. Last synced ${lastSyncedMinutesAgo} minutes ago.`
          : 'Leave balance data is temporarily unavailable. Displayed balances may be outdated. Request submissions are disabled.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 font-medium underline hover:no-underline"
        >
          Retry now
        </button>
      )}
    </div>
  )
}
