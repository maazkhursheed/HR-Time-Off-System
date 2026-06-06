import { hcmFetch } from './client'
import type { HCMLeaveRequest, HCMCreateRequestPayload, HCMUpdateRequestPayload } from './types'
import type { LeaveRequest, LeaveStatus, LeaveType } from '@/types/leave'

const HCM_STATUS_MAP: Record<string, LeaveStatus> = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  REJECTED_BY_HCM: 'rejected_by_hcm',
}

const HCM_TYPE_MAP: Record<string, LeaveType> = {
  ANNUAL: 'annual',
  SICK: 'sick',
  UNPAID: 'unpaid',
  COMPASSIONATE: 'compassionate',
}

function mapHCMRequest(raw: HCMLeaveRequest): Partial<LeaveRequest> {
  return {
    id: raw.requestId,
    userId: raw.employeeId,
    type: HCM_TYPE_MAP[raw.leaveTypeCode] ?? 'annual',
    startDate: raw.startDate,
    endDate: raw.endDate,
    businessDays: raw.days,
    status: HCM_STATUS_MAP[raw.status] ?? 'pending',
    createdAt: raw.submittedAt,
    updatedAt: raw.updatedAt,
  }
}

export async function createHCMRequest(
  payload: HCMCreateRequestPayload
): Promise<Partial<LeaveRequest>> {
  const raw = await hcmFetch<HCMLeaveRequest>('/leave-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapHCMRequest(raw)
}

export async function patchHCMRequest(
  payload: HCMUpdateRequestPayload
): Promise<Partial<LeaveRequest>> {
  const raw = await hcmFetch<HCMLeaveRequest>(
    `/leave-requests/${payload.requestId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  )
  return mapHCMRequest(raw)
}
