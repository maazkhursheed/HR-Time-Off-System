import type { RichBalance } from '@/lib/query/balance'
import type { LeaveRequest } from '@/types/leave'

export const JUST_NOW = new Date(Date.now() - 10_000).toISOString()
export const STALE_TS = new Date(Date.now() - 20 * 60 * 1000).toISOString()

// ── Alice Chen (employee, user-emp-001) ────────────────────────────────────────
export const ALICE: RichBalance = {
  employeeId: 'user-emp-001',
  employeeName: 'Alice Chen',
  location: 'New York, US',
  annual: 18,
  sick: 10,
  unpaid: 0,
  compassionate: 5,
  lastSynced: JUST_NOW,
  anniversaryBonusApplied: false,
  inconsistencyDetected: false,
}

export const ALICE_ANNIVERSARY: RichBalance = {
  ...ALICE,
  annual: 12,
  anniversaryBonusApplied: true,
}

export const ALICE_STALE: RichBalance = {
  ...ALICE,
  lastSynced: STALE_TS,
}

export const ALICE_INCONSISTENT: RichBalance = {
  ...ALICE,
  inconsistencyDetected: true,
}

export const ALICE_LOW: RichBalance = {
  ...ALICE,
  annual: 2,
}

// ── Carlos Rivera (London, UK, user-emp-002) ───────────────────────────────────
export const CARLOS: RichBalance = {
  employeeId: 'user-emp-002',
  employeeName: 'Carlos Rivera',
  location: 'London, UK',
  annual: 26,
  sick: 10,
  unpaid: 0,
  compassionate: 5,
  lastSynced: JUST_NOW,
  anniversaryBonusApplied: false,
  inconsistencyDetected: false,
}

// ── Diana Park (Singapore, SG, user-emp-003) ────────────────────────────────────
export const DIANA: RichBalance = {
  employeeId: 'user-emp-003',
  employeeName: 'Diana Park',
  location: 'Singapore, SG',
  annual: 14,
  sick: 10,
  unpaid: 0,
  compassionate: 5,
  lastSynced: JUST_NOW,
  anniversaryBonusApplied: false,
  inconsistencyDetected: false,
}

// ── Leave requests ─────────────────────────────────────────────────────────────
export const ALICE_PENDING: LeaveRequest = {
  id: 'req-001',
  userId: 'user-emp-001',
  type: 'annual',
  startDate: '2026-06-10',
  endDate: '2026-06-12',
  businessDays: 3,
  status: 'pending',
  idempotencyKey: 'idem-001',
  createdAt: JUST_NOW,
  updatedAt: JUST_NOW,
}

// Same request ID as ALICE_PENDING — used to simulate a silent status transition
export const ALICE_PENDING_THEN_REJECTED: LeaveRequest = {
  ...ALICE_PENDING,
  status: 'rejected_by_hcm',
}

export const ALICE_HCM_REJECT: LeaveRequest = {
  ...ALICE_PENDING,
  id: 'req-002',
  status: 'rejected_by_hcm',
}

export const CARLOS_PENDING: LeaveRequest = {
  id: 'req-carlos-001',
  userId: 'user-emp-002',
  type: 'annual',
  startDate: '2026-07-01',
  endDate: '2026-07-04',
  businessDays: 4,
  status: 'pending',
  idempotencyKey: 'idem-c01',
  createdAt: JUST_NOW,
  updatedAt: JUST_NOW,
  notes: 'Summer vacation',
}

export const DIANA_PENDING: LeaveRequest = {
  id: 'req-diana-001',
  userId: 'user-emp-003',
  type: 'sick',
  startDate: '2026-06-08',
  endDate: '2026-06-08',
  businessDays: 1,
  status: 'pending',
  idempotencyKey: 'idem-d01',
  createdAt: JUST_NOW,
  updatedAt: JUST_NOW,
}

// 30 business days requested against 26 available → would overdraw
export const CARLOS_OVERDRAW: LeaveRequest = {
  ...CARLOS_PENDING,
  id: 'req-carlos-overdraw',
  businessDays: 30,
}

// ── HCM wire-format helpers (for fetch mocking) ───────────────────────────────

export function hcmBalanceResponse(b: RichBalance) {
  return {
    employeeId: b.employeeId,
    employeeName: b.employeeName,
    location: b.location,
    leaveTypes: [
      { code: 'ANNUAL', available: b.annual },
      { code: 'SICK', available: b.sick },
      { code: 'UNPAID', available: b.unpaid },
      { code: 'COMPASSIONATE', available: b.compassionate },
    ],
    asOf: b.lastSynced,
    _meta: {
      anniversaryBonusApplied: b.anniversaryBonusApplied,
      inconsistencyApplied: b.inconsistencyDetected,
    },
  }
}

export function hcmBatchBalanceResponse(balances: RichBalance[]) {
  return { balances: balances.map(hcmBalanceResponse) }
}

export function hcmRequestsResponse(requests: LeaveRequest[]) {
  return {
    requests: requests.map((r) => ({
      requestId: r.id,
      employeeId: r.userId,
      leaveTypeCode: r.type.toUpperCase(),
      startDate: r.startDate,
      endDate: r.endDate,
      days: r.businessDays,
      status: r.status.toUpperCase(),
      submittedAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    total: requests.length,
  }
}
