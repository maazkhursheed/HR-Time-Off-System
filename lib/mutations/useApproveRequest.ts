'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { useUIStore } from '@/store/useUIStore'
import { approveRequest } from '@/lib/actions/approveRequest'
import type { LeaveRequest } from '@/types/leave'

interface ApproveRequestVars {
  requestId: string
  managerId: string
  employeeId: string
  note?: string
}

export function useApproveRequest() {
  const queryClient = useQueryClient()
  const pushToast = useUIStore((s) => s.pushToast)

  return useMutation({
    mutationFn: (vars: ApproveRequestVars) =>
      approveRequest(vars.requestId, vars.managerId, vars.employeeId, vars.note),

    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.teamRequests(vars.managerId) })
      const previous = queryClient.getQueryData<LeaveRequest[]>(queryKeys.teamRequests(vars.managerId))
      queryClient.setQueryData<LeaveRequest[]>(
        queryKeys.teamRequests(vars.managerId),
        (old) => old?.filter((r) => r.id !== vars.requestId) ?? []
      )
      return { previous }
    },

    onSuccess: (result, vars, context) => {
      if (!result.success) {
        if (context?.previous) {
          queryClient.setQueryData(queryKeys.teamRequests(vars.managerId), context.previous)
        }
        pushToast({ variant: 'error', message: result.error?.message ?? 'Approval failed.' })
        return
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.teamBalance(vars.managerId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.balance(vars.employeeId) })
      pushToast({ variant: 'success', message: 'Request approved.' })
    },

    onError: (_err, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.teamRequests(vars.managerId), context.previous)
      }
      pushToast({ variant: 'error', message: 'Could not approve request. Please try again.' })
    },

    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teamRequests(vars.managerId) })
    },
  })
}
