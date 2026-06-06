/**
 * Simulation helpers for the mock HCM API.
 *
 * All probabilities are per-request. They are intentionally low so the happy
 * path remains the common case during development, while edge cases surface
 * regularly enough to be caught during manual testing.
 */

import type { EmployeeRecord, RequestRecord, HCMLeaveCode } from './_store'
import type { HCMLeaveBalance, HCMLeaveRequest } from '@/lib/services/hcm/types'

// ─── Simulation probabilities ─────────────────────────────────────────────────

/** Probability that a submitted request will silently fail (Pattern A, §12.1). */
export const SILENT_FAILURE_PROBABILITY = 0.12

/**
 * Probability that a single balance read returns a slightly inconsistent value.
 * Applied per employee per read, independently.
 */
export const INCONSISTENT_BALANCE_PROBABILITY = 0.08

// ─── Scenario override header / query param ───────────────────────────────────
//
// Callers can force specific scenarios for deterministic testing:
//
//   GET /api/hcm/balance?_scenario=inconsistent
//   GET /api/hcm/balances/batch?_scenario=inconsistent
//   POST /api/hcm/request  →  body field `_scenario: "silent_failure"`
//   POST /api/hcm/request  →  body field `_scenario: "insufficient_balance"`
//
// Production code should never send `_scenario`; the mock strips it before
// processing.

export type Scenario = 'inconsistent' | 'silent_failure' | 'insufficient_balance' | 'anniversary_force'

// ─── Balance variance ─────────────────────────────────────────────────────────

/**
 * Returns a small variance (±1–2 days) to apply to the ANNUAL balance on a
 * read, or 0 if the read is consistent this time.
 *
 * The variance is applied only to ANNUAL because that is the leave type most
 * affected by mid-day accrual runs and read-replica lag in real HCM systems.
 * It is NOT persisted — only the API response is affected, not the store.
 *
 * Possible outcomes:
 *   +2: HCM read-replica already sees a pending accrual not yet committed
 *   +1: Partial accrual visible
 *   0:  Consistent (most common path)
 *   -1: Read-replica slightly behind after a recent deduction
 *   -2: Two-step deduction race condition (rare)
 */
export function computeAnnualVariance(forcedScenario?: Scenario): number {
  const fires =
    forcedScenario === 'inconsistent' ||
    Math.random() < INCONSISTENT_BALANCE_PROBABILITY

  if (!fires) return 0

  const magnitudes = [1, 2]
  const magnitude = magnitudes[Math.floor(Math.random() * magnitudes.length)]
  return Math.random() < 0.6 ? magnitude : -magnitude // slightly favour positive variance
}

// ─── Response formatters ──────────────────────────────────────────────────────

/**
 * Format an EmployeeRecord into the HCM wire response for a single employee.
 * The `annualVariance` is applied to the ANNUAL available field only.
 */
export function formatBalanceResponse(
  employee: EmployeeRecord,
  annualVariance: number,
  anniversaryApplied: boolean
): HCMLeaveBalance & {
  employeeName: string
  location: string
  _meta?: { anniversaryBonusApplied: boolean; inconsistencyApplied: boolean }
} {
  const leaveTypes: HCMLeaveBalance['leaveTypes'] = (
    ['ANNUAL', 'SICK', 'UNPAID', 'COMPASSIONATE'] as HCMLeaveCode[]
  ).map((code) => {
    const available = employee.balance[code] + (code === 'ANNUAL' ? annualVariance : 0)
    const total = employee.entitlement[code]
    const used = total - employee.balance[code]
    return {
      code,
      available: Math.max(0, available),
      used: Math.max(0, used),
      total,
    }
  })

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    location: employee.location,
    leaveTypes,
    asOf: new Date().toISOString(),
    _meta: {
      anniversaryBonusApplied: anniversaryApplied,
      inconsistencyApplied: annualVariance !== 0,
    },
  }
}

/**
 * Format a RequestRecord into the HCM wire response.
 * Internal `_`-prefixed fields are stripped.
 */
export function formatRequestResponse(record: RequestRecord): HCMLeaveRequest {
  return {
    requestId: record.id,
    employeeId: record.employeeId,
    leaveTypeCode: record.leaveTypeCode,
    startDate: record.startDate,
    endDate: record.endDate,
    days: record.days,
    status: record.status,
    rejectionReason: record.rejectionReason,
    submittedAt: record.submittedAt,
    updatedAt: record.updatedAt,
  }
}

// ─── Delay simulation ─────────────────────────────────────────────────────────

/**
 * Returns an artificial latency for the given endpoint class.
 * Batch endpoints are slower to reflect real HCM behaviour.
 */
export function simulatedLatencyMs(endpoint: 'realtime' | 'batch'): number {
  const ranges: Record<typeof endpoint, [number, number]> = {
    realtime: [120, 450],
    batch: [600, 1200],
  }
  const [min, max] = ranges[endpoint]
  return Math.floor(Math.random() * (max - min)) + min
}
