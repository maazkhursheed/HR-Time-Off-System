// Raw Time-Off service DB types

export interface TORequest {
  id: string
  userId: string
  managerId?: string
  leaveType: string
  startDate: string
  endDate: string
  businessDays: number
  status: string
  notes?: string
  managerNote?: string
  idempotencyKey: string
  hcmRequestId?: string
  createdAt: string
  updatedAt: string
}

export interface TOCreateRequestPayload {
  userId: string
  leaveType: string
  startDate: string
  endDate: string
  businessDays: number
  notes?: string
  idempotencyKey: string
}

export interface TOPatchRequestPayload {
  action: 'approve' | 'reject' | 'cancel'
  managerId?: string
  note?: string
}
