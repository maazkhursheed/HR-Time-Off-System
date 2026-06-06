export const CHANNEL_NAME = 'timeoff-sync'

export type TimeOffSyncMessage = {
  type: 'REQUEST_STATUS_CHANGED'
  employeeId: string
  managerId: string
}

/**
 * Posts a one-shot message to every other tab on the same origin.
 * Creates a fresh channel, sends, and immediately closes — no persistent state.
 * Guards against SSR (no window) and environments that lack BroadcastChannel (jsdom).
 */
export function broadcastStatusChange(employeeId: string, managerId: string): void {
  if (typeof window === 'undefined' || !('BroadcastChannel' in globalThis)) return
  const ch = new BroadcastChannel(CHANNEL_NAME)
  ch.postMessage({ type: 'REQUEST_STATUS_CHANGED', employeeId, managerId } satisfies TimeOffSyncMessage)
  // postMessage is fire-and-forget; close is safe immediately after.
  ch.close()
}
