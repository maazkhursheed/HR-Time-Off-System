'use client'

import { useEffect, useRef, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './keys'
import { STALE_TIMES } from './config'
import { useUIStore } from '@/store/useUIStore'
import type { LeaveRequest, LeaveType, LeaveStatus } from '@/types/leave'

interface HCMLeaveRequestRaw {
  requestId: string
  employeeId: string
  leaveTypeCode: string
  startDate: string
  endDate: string
  days: number
  status: string
  rejectionReason?: string
  submittedAt: string
  updatedAt: string
}

function mapHCMRequest(raw: HCMLeaveRequestRaw): LeaveRequest {
  return {
    id: raw.requestId,
    userId: raw.employeeId,
    type: raw.leaveTypeCode.toLowerCase() as LeaveType,
    startDate: raw.startDate,
    endDate: raw.endDate,
    businessDays: raw.days,
    status: raw.status.toLowerCase() as LeaveStatus,
    idempotencyKey: '',
    createdAt: raw.submittedAt,
    updatedAt: raw.updatedAt,
  }
}

export function useRequests(userId: string) {
  const queryClient = useQueryClient()
  const pushToast = useUIStore((s) => s.pushToast)
  const prevStatusMap = useRef<Map<string, LeaveStatus>>(new Map())

  const query = useQuery({
    queryKey: queryKeys.requests(userId),
    queryFn: async (): Promise<LeaveRequest[]> => {
      const res = await fetch(`/api/hcm/requests?employeeId=${userId}`)
      if (!res.ok) throw new Error(`Requests fetch failed: ${res.status}`)
      const json: { requests: HCMLeaveRequestRaw[] } = await res.json()
      return json.requests.map(mapHCMRequest)
    },
    staleTime: STALE_TIMES.requests,
    refetchOnWindowFocus: true,
    // Poll every 2 min while any request is in pending state (TRD §12.2).
    // refetchOnWindowFocus handles the interactive cross-tab case instantly;
    // this interval catches changes while the tab stays open in the foreground.
    // Stops when no pending requests remain so idle employees generate no traffic.
    refetchInterval: (query) => {
      const data = query.state.data as LeaveRequest[] | undefined
      return data?.some((r) => r.status === 'pending') ? 120_000 : false
    },
  })

  // Status-transition detection: surface terminal transitions as toasts and
  // invalidate balance whenever HCM changes the balance on its side.
  useEffect(() => {
    const requests = query.data
    if (!requests) return

    for (const req of requests) {
      const prevStatus = prevStatusMap.current.get(req.id)

      if (prevStatus === 'pending' && req.status !== 'pending') {
        // Any exit from pending means HCM processed the request.
        // Invalidate balance regardless of outcome — HCM may have changed it.
        queryClient.invalidateQueries({ queryKey: queryKeys.balance(userId) })

        if (req.status === 'approved') {
          pushToast({
            variant: 'success',
            message: `Your ${req.type} leave (${req.startDate}–${req.endDate}) was approved.`,
          })
        } else if (req.status === 'rejected') {
          pushToast({
            variant: 'error',
            message: `Your ${req.type} leave (${req.startDate}–${req.endDate}) was rejected. Your balance has been restored.`,
          })
        } else if (req.status === 'rejected_by_hcm') {
          pushToast({
            variant: 'error',
            message: `Your ${req.type} leave request (${req.startDate}–${req.endDate}) was rejected by HCM. Balance has been restored.`,
          })
        }
      }
    }

    prevStatusMap.current = new Map(requests.map((r) => [r.id, r.status]))
  }, [query.data, pushToast, queryClient, userId])

  return query
}

export function useRequest(requestId: string) {
  return useQuery({
    queryKey: queryKeys.request(requestId),
    queryFn: async (): Promise<LeaveRequest> => {
      const res = await fetch(`/api/hcm/request/${requestId}`)
      if (!res.ok) throw new Error(`Request fetch failed: ${res.status}`)
      const raw: HCMLeaveRequestRaw = await res.json()
      return mapHCMRequest(raw)
    },
    staleTime: STALE_TIMES.requests,
    // Poll every 2 minutes while pending — surfaces silent HCM rejections
    refetchInterval: (query) => {
      const data = query.state.data as LeaveRequest | undefined
      return data?.status === 'pending' ? 120_000 : false
    },
  })
}

export function usePendingRequests(userId: string): LeaveRequest[] {
  const { data } = useRequests(userId)
  return useMemo(() => data?.filter((r) => r.status === 'pending') ?? [], [data])
}
