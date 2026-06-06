export type LeaveStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'rejected_by_hcm'

export type LeaveType = 'annual' | 'sick' | 'unpaid' | 'compassionate'

export interface LeaveBalance {
  annual: number
  sick: number
  unpaid: number
  compassionate: number
  lastSynced: string
}

export interface LeaveRequest {
  id: string
  userId: string
  type: LeaveType
  startDate: string
  endDate: string
  businessDays: number
  status: LeaveStatus
  notes?: string
  idempotencyKey: string
  createdAt: string
  updatedAt: string
  managerId?: string
  managerNote?: string
}

export interface DateRange {
  startDate: string
  endDate: string
}

export interface RequestFilters {
  status?: LeaveStatus[]
  type?: LeaveType[]
  dateRange?: DateRange
  page?: number
  pageSize?: number
}

export interface TeamCalendarEntry {
  userId: string
  employeeName: string
  type: LeaveType
  startDate: string
  endDate: string
  status: LeaveStatus
}
