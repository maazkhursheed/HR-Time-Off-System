'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from './keys'
import { STALE_TIMES } from './config'
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

export function useTeamRequests(managerId: string) {
  return useQuery({
    queryKey: queryKeys.teamRequests(managerId),
    queryFn: async (): Promise<LeaveRequest[]> => {
      const res = await fetch(`/api/hcm/requests?managerId=${managerId}`)
      if (!res.ok) throw new Error(`Team requests fetch failed: ${res.status}`)
      const json: { requests: HCMLeaveRequestRaw[] } = await res.json()
      return json.requests.map(mapHCMRequest)
    },
    staleTime: STALE_TIMES.teamRequests,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  })
}
