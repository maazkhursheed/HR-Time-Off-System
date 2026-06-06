import { toFetch } from './client'
import type { TORequest, TOCreateRequestPayload, TOPatchRequestPayload } from './types'
import type { LeaveRequest, LeaveStatus, LeaveType, RequestFilters } from '@/types/leave'

function mapTORequest(raw: TORequest): LeaveRequest {
  return {
    id: raw.id,
    userId: raw.userId,
    managerId: raw.managerId,
    type: raw.leaveType as LeaveType,
    startDate: raw.startDate,
    endDate: raw.endDate,
    businessDays: raw.businessDays,
    status: raw.status as LeaveStatus,
    notes: raw.notes,
    managerNote: raw.managerNote,
    idempotencyKey: raw.idempotencyKey,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

export async function getRequests(
  userId: string,
  filters: RequestFilters = {}
): Promise<{ requests: LeaveRequest[]; total: number }> {
  const params = new URLSearchParams({ userId })
  if (filters.status?.length) params.set('status', filters.status.join(','))
  if (filters.type?.length) params.set('type', filters.type.join(','))
  if (filters.page) params.set('page', String(filters.page))
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize))

  const raw = await toFetch<{ data: TORequest[]; total: number }>(
    `/requests?${params}`
  )
  return { requests: raw.data.map(mapTORequest), total: raw.total }
}

export async function createRequest(
  payload: TOCreateRequestPayload
): Promise<LeaveRequest> {
  const raw = await toFetch<{ data: TORequest }>('/requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapTORequest(raw.data)
}

export async function patchRequest(
  requestId: string,
  payload: TOPatchRequestPayload
): Promise<LeaveRequest> {
  const raw = await toFetch<{ data: TORequest }>(`/requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return mapTORequest(raw.data)
}

export async function getTeamRequests(
  managerId: string
): Promise<{ requests: LeaveRequest[]; total: number }> {
  const raw = await toFetch<{ data: TORequest[]; total: number }>(
    `/requests/team?managerId=${managerId}&status=pending`
  )
  return { requests: raw.data.map(mapTORequest), total: raw.total }
}
