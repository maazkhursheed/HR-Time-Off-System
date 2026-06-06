/**
 * In-memory HCM store. Persists across Next.js HMR restarts via globalThis.
 *
 * Balance model:
 *   - APPROVED requests permanently deduct balance.
 *   - Normal PENDING requests deduct balance immediately (holding the days).
 *   - Silent-failure PENDING requests do NOT deduct balance — this is the
 *     intended inconsistency: the frontend sees a pending request but HCM
 *     still shows the full balance, triggering reconciliation.
 *   - REJECTED / CANCELLED / REJECTED_BY_HCM restore balance if it was held.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type HCMLeaveCode = 'ANNUAL' | 'SICK' | 'UNPAID' | 'COMPASSIONATE'

export type HCMRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'REJECTED_BY_HCM'

export interface EmployeeRecord {
  id: string
  name: string
  /** ISO date YYYY-MM-DD */
  hireDate: string
  location: string
  /** ID of the manager this employee reports to */
  managerId?: string
  /** Current available balance per leave type */
  balance: Record<HCMLeaveCode, number>
  /** Annual entitlement (used to compute the "total" field in responses) */
  entitlement: Record<HCMLeaveCode, number>
  /** Prevents double-applying the anniversary bonus in the same calendar year */
  anniversaryBonusAppliedYear: number | null
}

export interface RequestRecord {
  id: string
  employeeId: string
  leaveTypeCode: HCMLeaveCode
  startDate: string
  endDate: string
  days: number
  status: HCMRequestStatus
  idempotencyKey: string
  notes?: string
  submittedAt: string
  updatedAt: string
  rejectionReason?: string
  /** Whether this request will be silently rejected after a delay */
  _willSilentlyReject: boolean
  /** Unix ms timestamp at which the silent rejection fires */
  _silentRejectAt: number | null
  /** Whether balance was deducted for this request (for restoration on reject) */
  _balanceDeducted: boolean
}

export interface HCMStore {
  employees: Record<string, EmployeeRecord>
  requests: Record<string, RequestRecord>
  /** idempotencyKey → requestId */
  idempotencyIndex: Record<string, string>
  _requestCounter: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Leave types that have a finite balance. UNPAID is effectively unlimited. */
export const FINITE_BALANCE_TYPES = new Set<HCMLeaveCode>(['ANNUAL', 'SICK', 'COMPASSIONATE'])

/** Delay before a silently-failing request surfaces as REJECTED_BY_HCM (ms) */
export const SILENT_REJECT_DELAY_MS = 15_000

/** Number of bonus days awarded on work anniversary */
export const ANNIVERSARY_BONUS_DAYS = 2

/** Window after the anniversary date during which the bonus is applied */
export const ANNIVERSARY_WINDOW_DAYS = 7

// ─── Seed data ────────────────────────────────────────────────────────────────
//
// Hire dates are chosen so that three employees have anniversaries within the
// 7-day window of the project reference date (2026-06-05), enabling anniversary
// bonus simulation to fire without any manual triggering.
//
//  emp-001 — hireDate 2022-06-03 → anniversary June 3,  2 days ago  ✓ in window
//  emp-002 — hireDate 2023-05-30 → anniversary May 30,  6 days ago  ✓ in window
//  emp-003 — hireDate 2021-09-15 → anniversary Sept 15, not in window (control)
//  mgr-001 — hireDate 2019-06-01 → anniversary June 1,  4 days ago  ✓ in window

function buildSeedData(): Pick<HCMStore, 'employees'> {
  const employees: EmployeeRecord[] = [
    {
      id: 'user-emp-001',
      name: 'Alice Chen',
      hireDate: '2022-06-03',
      location: 'New York, US',
      managerId: 'user-mgr-001',
      entitlement: { ANNUAL: 20, SICK: 10, UNPAID: 999, COMPASSIONATE: 5 },
      balance:     { ANNUAL: 10, SICK: 5,  UNPAID: 999, COMPASSIONATE: 3 },
      anniversaryBonusAppliedYear: null,
    },
    {
      id: 'user-emp-002',
      name: 'Carlos Rivera',
      hireDate: '2023-05-30',
      location: 'London, UK',
      managerId: 'user-mgr-001',
      entitlement: { ANNUAL: 28, SICK: 10, UNPAID: 999, COMPASSIONATE: 5 },
      balance:     { ANNUAL: 8,  SICK: 3,  UNPAID: 999, COMPASSIONATE: 5 },
      anniversaryBonusAppliedYear: null,
    },
    {
      id: 'user-emp-003',
      name: 'Diana Park',
      hireDate: '2021-09-15',
      location: 'Singapore, SG',
      managerId: 'user-mgr-001',
      entitlement: { ANNUAL: 14, SICK: 14, UNPAID: 999, COMPASSIONATE: 5 },
      balance:     { ANNUAL: 15, SICK: 7,  UNPAID: 999, COMPASSIONATE: 5 },
      anniversaryBonusAppliedYear: null,
    },
    {
      id: 'user-mgr-001',
      name: 'Bob Smith',
      hireDate: '2019-06-01',
      location: 'New York, US',
      entitlement: { ANNUAL: 25, SICK: 15, UNPAID: 999, COMPASSIONATE: 5 },
      balance:     { ANNUAL: 18, SICK: 10, UNPAID: 999, COMPASSIONATE: 5 },
      anniversaryBonusAppliedYear: null,
    },
  ]
  return { employees: Object.fromEntries(employees.map((e) => [e.id, e])) }
}

// ─── Store singleton (HMR-safe) ───────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __hcmMockStore: HCMStore | undefined
}

export function getStore(): HCMStore {
  if (!globalThis.__hcmMockStore) {
    globalThis.__hcmMockStore = {
      ...buildSeedData(),
      requests: {},
      idempotencyIndex: {},
      _requestCounter: 1000,
    }
  }
  return globalThis.__hcmMockStore
}

export function resetStore(): void {
  globalThis.__hcmMockStore = undefined
}

// ─── Store operations ─────────────────────────────────────────────────────────

export function findEmployee(id: string): EmployeeRecord | null {
  return getStore().employees[id] ?? null
}

/**
 * Materialise a pending silent rejection if its delay has elapsed, then return
 * the request. Callers always get the up-to-date status.
 */
export function findRequest(id: string): RequestRecord | null {
  const store = getStore()
  const req = store.requests[id]
  if (!req) return null

  if (
    req._willSilentlyReject &&
    req._silentRejectAt !== null &&
    Date.now() >= req._silentRejectAt &&
    req.status === 'PENDING'
  ) {
    req.status = 'REJECTED_BY_HCM'
    req.rejectionReason = 'Entitlement recalculation invalidated this request.'
    req.updatedAt = new Date().toISOString()
    // No balance to restore — silent-failure requests never deducted balance.
  }

  return req
}

export type CreateRequestResult =
  | { ok: true; request: RequestRecord }
  | { ok: false; reason: 'EMPLOYEE_NOT_FOUND' | 'INSUFFICIENT_BALANCE' }

export function createRequest(params: {
  employeeId: string
  leaveTypeCode: HCMLeaveCode
  startDate: string
  endDate: string
  days: number
  idempotencyKey: string
  notes?: string
  forceSilentFailure?: boolean
  silentFailureProbability: number
}): CreateRequestResult {
  const store = getStore()

  // Idempotency: return the original result for duplicate keys.
  const existingId = store.idempotencyIndex[params.idempotencyKey]
  if (existingId) {
    const existing = findRequest(existingId)
    if (existing) return { ok: true, request: existing }
  }

  const employee = store.employees[params.employeeId]
  if (!employee) return { ok: false, reason: 'EMPLOYEE_NOT_FOUND' }

  // Balance validation (skip for UNPAID — effectively unlimited)
  if (FINITE_BALANCE_TYPES.has(params.leaveTypeCode) && params.leaveTypeCode !== 'UNPAID') {
    if (employee.balance[params.leaveTypeCode] < params.days) {
      return { ok: false, reason: 'INSUFFICIENT_BALANCE' }
    }
  }

  const willSilentlyReject =
    params.forceSilentFailure ?? Math.random() < params.silentFailureProbability

  const now = new Date().toISOString()
  const id = `hcm-req-${++store._requestCounter}`

  const request: RequestRecord = {
    id,
    employeeId: params.employeeId,
    leaveTypeCode: params.leaveTypeCode,
    startDate: params.startDate,
    endDate: params.endDate,
    days: params.days,
    status: 'PENDING',
    idempotencyKey: params.idempotencyKey,
    notes: params.notes,
    submittedAt: now,
    updatedAt: now,
    _willSilentlyReject: willSilentlyReject,
    _silentRejectAt: willSilentlyReject ? Date.now() + SILENT_REJECT_DELAY_MS : null,
    _balanceDeducted: !willSilentlyReject,
  }

  store.requests[id] = request
  store.idempotencyIndex[params.idempotencyKey] = id

  // Only deduct balance for requests that will NOT silently fail.
  // For silent failures, HCM accepts but never commits the hold — that
  // mismatch (pending request + unchanged balance) is the test signal.
  if (!willSilentlyReject && FINITE_BALANCE_TYPES.has(params.leaveTypeCode)) {
    employee.balance[params.leaveTypeCode] -= params.days
  }

  return { ok: true, request }
}

/**
 * Check whether today falls within the anniversary bonus window for this
 * employee. Mutates the store if the bonus should be applied. Returns true
 * if the bonus was applied on this call.
 */
export function applyAnniversaryBonusIfDue(employee: EmployeeRecord): boolean {
  const today = new Date()
  const currentYear = today.getFullYear()

  if (employee.anniversaryBonusAppliedYear === currentYear) return false

  const [, hireMonthStr, hireDayStr] = employee.hireDate.split('-')
  const hireMonth = parseInt(hireMonthStr, 10)
  const hireDay = parseInt(hireDayStr, 10)

  const anniversaryThisYear = new Date(currentYear, hireMonth - 1, hireDay)
  const msElapsed = today.getTime() - anniversaryThisYear.getTime()
  const daysElapsed = msElapsed / (1000 * 60 * 60 * 24)

  if (daysElapsed >= 0 && daysElapsed < ANNIVERSARY_WINDOW_DAYS) {
    employee.balance.ANNUAL += ANNIVERSARY_BONUS_DAYS
    employee.entitlement.ANNUAL += ANNIVERSARY_BONUS_DAYS
    employee.anniversaryBonusAppliedYear = currentYear
    return true
  }

  return false
}

// ─── Request mutation ─────────────────────────────────────────────────────────

export type UpdateRequestResult =
  | { ok: true; request: RequestRecord }
  | { ok: false; reason: 'NOT_FOUND' | 'ALREADY_TERMINAL' | 'INVALID_TRANSITION' }

const TERMINAL_STATUSES = new Set<HCMRequestStatus>(['APPROVED', 'REJECTED', 'CANCELLED', 'REJECTED_BY_HCM'])

export function updateRequest(
  requestId: string,
  action: 'approve' | 'reject' | 'cancel',
  note?: string
): UpdateRequestResult {
  const store = getStore()
  const req = findRequest(requestId) // materialises any pending silent rejection first
  if (!req) return { ok: false, reason: 'NOT_FOUND' }
  if (TERMINAL_STATUSES.has(req.status)) return { ok: false, reason: 'ALREADY_TERMINAL' }
  if (req.status !== 'PENDING') return { ok: false, reason: 'INVALID_TRANSITION' }

  const employee = store.employees[req.employeeId]
  const now = new Date().toISOString()

  if (action === 'approve') {
    req.status = 'APPROVED'
    req.updatedAt = now
    if (note) req.rejectionReason = note
  } else {
    req.status = action === 'cancel' ? 'CANCELLED' : 'REJECTED'
    req.rejectionReason = note
    req.updatedAt = now
    // Restore balance if it was held
    if (req._balanceDeducted && employee && FINITE_BALANCE_TYPES.has(req.leaveTypeCode)) {
      employee.balance[req.leaveTypeCode] += req.days
      req._balanceDeducted = false
    }
  }

  return { ok: true, request: req }
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export function listRequestsByEmployee(employeeId: string): RequestRecord[] {
  const store = getStore()
  return Object.values(store.requests)
    .filter((r) => r.employeeId === employeeId)
    .map((r) => findRequest(r.id)!)  // materialises silent rejections
    .filter(Boolean)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

export function listRequestsByManager(managerId: string): RequestRecord[] {
  const store = getStore()
  const teamEmployeeIds = new Set(
    Object.values(store.employees)
      .filter((e) => e.managerId === managerId)
      .map((e) => e.id)
  )
  return Object.values(store.requests)
    .filter((r) => teamEmployeeIds.has(r.employeeId))
    .map((r) => findRequest(r.id)!)
    .filter(Boolean)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}
