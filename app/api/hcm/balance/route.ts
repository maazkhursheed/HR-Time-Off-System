/**
 * GET /api/hcm/balance?employeeId=<id>[&_scenario=<scenario>]
 *
 * Real-time balance read for a single employee.
 *
 * Simulations that may fire on any given request:
 *   1. Anniversary bonus — if today is within 7 days of the employee's hire
 *      date anniversary, add 2 days to ANNUAL balance (once per year).
 *   2. Inconsistent balance — with 8% probability, return an ANNUAL balance
 *      that is ±1–2 days off. The variance is read-only; the stored balance
 *      is not mutated. Forces via ?_scenario=inconsistent.
 *
 * Force an anniversary for any employee during testing:
 *   ?_scenario=anniversary_force   — skips the date check
 */

import type { NextRequest } from 'next/server'
import {
  findEmployee,
  applyAnniversaryBonusIfDue,
  ANNIVERSARY_BONUS_DAYS,
  ANNIVERSARY_WINDOW_DAYS,
} from '../_store'
import {
  computeAnnualVariance,
  formatBalanceResponse,
  simulatedLatencyMs,
  type Scenario,
} from '../_simulate'

export async function GET(request: NextRequest) {
  await new Promise((r) => setTimeout(r, simulatedLatencyMs('realtime')))

  const params = request.nextUrl.searchParams
  const employeeId = params.get('employeeId')
  const scenario = params.get('_scenario') as Scenario | null

  if (!employeeId) {
    return Response.json(
      { errorCode: 'MISSING_EMPLOYEE_ID', errorMessage: 'employeeId query parameter is required.' },
      { status: 400 }
    )
  }

  const employee = findEmployee(employeeId)
  if (!employee) {
    return Response.json(
      { errorCode: 'EMPLOYEE_NOT_FOUND', errorMessage: `No employee found with id "${employeeId}".` },
      { status: 404 }
    )
  }

  // ── Simulation 1: Work anniversary bonus ────────────────────────────────
  // Normally triggered by the hire date window; forced by ?_scenario=anniversary_force.
  let anniversaryApplied = false
  if (scenario === 'anniversary_force') {
    // Force-apply regardless of hire date (useful for demo / integration tests).
    if (employee.anniversaryBonusAppliedYear !== new Date().getFullYear()) {
      employee.balance.ANNUAL += ANNIVERSARY_BONUS_DAYS
      employee.entitlement.ANNUAL += ANNIVERSARY_BONUS_DAYS
      employee.anniversaryBonusAppliedYear = new Date().getFullYear()
      anniversaryApplied = true
    }
  } else {
    anniversaryApplied = applyAnniversaryBonusIfDue(employee)
  }

  // ── Simulation 2: Inconsistent balance ──────────────────────────────────
  // A read-time variance on ANNUAL balance. Not persisted.
  const annualVariance = computeAnnualVariance(scenario ?? undefined)

  return Response.json(formatBalanceResponse(employee, annualVariance, anniversaryApplied))
}
