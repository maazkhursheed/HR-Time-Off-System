'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import type { GetNotificationsResponse } from '@/types/api'

export function useMarkNotificationsRead(userId: string) {
  const queryClient = useQueryClient()
  const key = queryKeys.notifications(userId)

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      })
      if (!res.ok) throw new Error('Failed to mark notifications read.')
      return res.json()
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<GetNotificationsResponse>(key)

      queryClient.setQueryData<GetNotificationsResponse>(key, (old) => {
        if (!old) return old
        return {
          ...old,
          unreadCount: 0,
          data: old.data.map((n) => ({ ...n, read: true })),
        }
      })

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
