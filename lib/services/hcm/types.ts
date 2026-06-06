// Raw HCM wire types — never leak past the service boundary

export interface HCMLeaveBalance {
  employeeId: string
  leaveTypes: {
    code: string
    available: number
    used: number
    total: number
  }[]
  asOf: string
}

export interface HCMLeaveRequest {
  requestId: string
  employeeId: string
  leaveTypeCode: string
  startDate: string
  endDate: string
  days: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'REJECTED_BY_HCM'
  rejectionReason?: string
  submittedAt: string
  updatedAt: string
}

export interface HCMCreateRequestPayload {
  employeeId: string
  leaveTypeCode: string
  startDate: string
  endDate: string
  days: number
  idempotencyKey: string
  notes?: string
}

export interface HCMUpdateRequestPayload {
  requestId: string
  action: 'APPROVE' | 'REJECT' | 'CANCEL'
  managerId?: string
  note?: string
}

export interface HCMError {
  errorCode: string
  errorMessage: string
  field?: string
}
