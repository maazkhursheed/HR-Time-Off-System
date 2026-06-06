import type { LeaveBalance, LeaveRequest, LeaveType, RequestFilters, TeamCalendarEntry } from './leave'
import type { User } from './user'

// GET /api/balance
export interface GetBalanceResponse {
  data: LeaveBalance
}

// GET /api/requests
export interface GetRequestsResponse {
  data: LeaveRequest[]
  total: number
  page: number
  pageSize: number
}

// POST /api/requests
export interface SubmitRequestBody {
  type: LeaveType
  startDate: string
  endDate: string
  notes?: string
  idempotencyKey: string
}
export interface SubmitRequestResponse {
  data: LeaveRequest
}

// PATCH /api/requests/:id
export type RequestAction = 'approve' | 'reject' | 'cancel'
export interface PatchRequestBody {
  action: RequestAction
  note?: string
}
export interface PatchRequestResponse {
  data: LeaveRequest
}

// GET /api/team/requests
export interface GetTeamRequestsResponse {
  data: LeaveRequest[]
  total: number
}

// GET /api/team/balances
export interface GetTeamBalancesResponse {
  data: Record<string, LeaveBalance>
  syncedAt: string
}

// GET /api/team/calendar
export interface GetTeamCalendarResponse {
  data: TeamCalendarEntry[]
}

// GET /api/notifications
export interface Notification {
  id: string
  userId: string
  type: 'request_approved' | 'request_rejected' | 'contradiction_detected' | 'balance_changed'
  message: string
  read: boolean
  createdAt: string
  metadata?: Record<string, string>
}
export interface GetNotificationsResponse {
  data: Notification[]
  unreadCount: number
}

// PATCH /api/notifications
export interface PatchNotificationsBody {
  action: 'mark_all_read'
}

// Shared API error shape
export interface ApiError {
  code: string
  message: string
  field?: string
}
export interface ApiErrorResponse {
  error: ApiError
}

// Query params helpers
export type GetRequestsParams = RequestFilters & { userId: string }
export type GetTeamRequestsParams = { managerId: string; status?: string }
export type GetTeamCalendarParams = { managerId: string; from: string; to: string }

export type WithUser<T> = T & { user: User }
