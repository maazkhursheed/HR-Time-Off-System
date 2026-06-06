'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { useUIStore } from '@/store/useUIStore'
import { cancelRequest } from '@/lib/actions/cancelRequest'

interface CancelRequestVars {
  requestId: string
  userId: string
  managerId?: string
}

export function useCancelRequest() {
  const queryClient = useQueryClient()
  const pushToast = useUIStore((s) => s.pushToast)

  return useMutation({
    mutationFn: (vars: CancelRequestVars) =>
      cancelRequest(vars.requestId, vars.userId, vars.managerId),
    onSuccess: (result, vars) => {
      if (!result.success) {
        pushToast({ variant: 'error', message: result.error?.message ?? 'Cancellation failed.' })
        return
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.requests(vars.userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.balance(vars.userId) })
      pushToast({ variant: 'success', message: 'Request cancelled.' })
    },
    onError: () => {
      pushToast({ variant: 'error', message: 'Could not cancel request. Please try again.' })
    },
  })
}
