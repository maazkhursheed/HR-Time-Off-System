import type { LeaveRequest } from '@/types/leave'

export const MOCK_PENDING_REQUEST: LeaveRequest = {
  id: 'req-001',
  userId: 'user-emp-001',
  type: 'annual',
  startDate: '2026-07-01',
  endDate: '2026-07-03',
  businessDays: 3,
  status: 'pending',
  notes: 'Summer break',
  idempotencyKey: 'idem-001',
  createdAt: '2026-06-01T10:00:00Z',
  updatedAt: '2026-06-01T10:00:00Z',
}

export const MOCK_APPROVED_REQUEST: LeaveRequest = {
  ...MOCK_PENDING_REQUEST,
  id: 'req-002',
  status: 'approved',
  managerId: 'user-mgr-001',
}

export const MOCK_REJECTED_REQUEST: LeaveRequest = {
  ...MOCK_PENDING_REQUEST,
  id: 'req-003',
  status: 'rejected',
  managerId: 'user-mgr-001',
  managerNote: 'Insufficient coverage',
}

export const MOCK_REQUESTS: LeaveRequest[] = [
  MOCK_PENDING_REQUEST,
  MOCK_APPROVED_REQUEST,
  MOCK_REJECTED_REQUEST,
]
