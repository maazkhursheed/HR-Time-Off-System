'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { useUIStore } from '@/store/useUIStore'
import { submitRequest } from '@/lib/actions/submitRequest'
import type { LeaveType } from '@/types/leave'

interface SubmitRequestVars {
  userId: string
  type: LeaveType
  startDate: string
  endDate: string
  businessDays: number
  notes?: string
  idempotencyKey: string
  managerId?: string
}

export function useSubmitRequest() {
  const queryClient = useQueryClient()
  const pushToast = useUIStore((s) => s.pushToast)

  return useMutation({
    mutationFn: (vars: SubmitRequestVars) => submitRequest(vars),
    onSuccess: (result, vars) => {
      if (!result.success) {
        pushToast({ variant: 'error', message: result.error?.message ?? 'Submission failed.' })
        return
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.requests(vars.userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.balance(vars.userId) })
      pushToast({ variant: 'success', message: 'Leave request submitted.' })
    },
    onError: () => {
      pushToast({ variant: 'error', message: 'Something went wrong. Please try again.' })
    },
  })
}
