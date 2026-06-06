import type { LeaveStatus } from '@/types/leave'
import type { Role } from '@/types/user'

const VALID_TRANSITIONS: Record<LeaveStatus, Partial<Record<Role, LeaveStatus[]>>> = {
  pending: {
    employee: ['cancelled'],
    manager: ['approved', 'rejected'],
  },
  approved: {
    employee: [],
    manager: ['cancelled'],
  },
  rejected: {},
  cancelled: {},
  rejected_by_hcm: {},
}

export function isValidTransition(
  from: LeaveStatus,
  to: LeaveStatus,
  role: Role
): boolean {
  return VALID_TRANSITIONS[from]?.[role]?.includes(to) ?? false
}

export function isTerminalStatus(status: LeaveStatus): boolean {
  return status === 'rejected' || status === 'cancelled' || status === 'rejected_by_hcm'
}

export function isStatusRegression(previous: LeaveStatus, current: LeaveStatus): boolean {
  const rank: Record<LeaveStatus, number> = {
    pending: 1,
    approved: 2,
    rejected: 0,
    cancelled: 0,
    rejected_by_hcm: 0,
  }
  return rank[previous] > 0 && rank[current] === 0
}
