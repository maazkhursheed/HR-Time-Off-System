'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CHANNEL_NAME, type TimeOffSyncMessage } from './timeoffChannel'
import { queryKeys } from '@/lib/query/keys'

/**
 * Listens for cross-tab REQUEST_STATUS_CHANGED events and invalidates the
 * relevant React Query cache entries so the receiving tab stays in sync
 * without a full page reload.
 *
 * Mount exactly once — inside QueryProvider, so every tab has one listener
 * bound to its own QueryClient instance.
 *
 * BroadcastChannel spec guarantees the sender tab does NOT receive its own
 * messages, so there is no risk of the Manager tab invalidating itself twice.
 */
export function useCrossTabSync(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in globalThis)) return

    const channel = new BroadcastChannel(CHANNEL_NAME)

    channel.onmessage = (event: MessageEvent<TimeOffSyncMessage>) => {
      const msg = event.data
      if (msg.type !== 'REQUEST_STATUS_CHANGED') return

      queryClient.invalidateQueries({ queryKey: queryKeys.balance(msg.employeeId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.requests(msg.employeeId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.teamRequests(msg.managerId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.teamBalance(msg.managerId) })
    }

    return () => channel.close()
  }, [queryClient])
}
