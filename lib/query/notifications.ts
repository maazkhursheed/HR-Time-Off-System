'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from './keys'
import { STALE_TIMES } from './config'
import type { GetNotificationsResponse } from '@/types/api'

export function useNotifications(userId: string) {
  return useQuery({
    queryKey: queryKeys.notifications(userId),
    queryFn: async (): Promise<GetNotificationsResponse> => {
      const res = await fetch(`/api/notifications?userId=${userId}`)
      if (!res.ok) throw new Error(`Notifications fetch failed: ${res.status}`)
      return res.json()
    },
    staleTime: STALE_TIMES.notifications,
    refetchOnWindowFocus: true,
  })
}
