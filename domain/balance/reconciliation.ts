const STALE_WARNING_MS = 15 * 60 * 1000 // 15 minutes

export function isBalanceStale(lastSynced: string): boolean {
  const syncedAt = new Date(lastSynced).getTime()
  return Date.now() - syncedAt > STALE_WARNING_MS
}

export function minutesSinceSync(lastSynced: string): number {
  const syncedAt = new Date(lastSynced).getTime()
  return Math.floor((Date.now() - syncedAt) / 60_000)
}
