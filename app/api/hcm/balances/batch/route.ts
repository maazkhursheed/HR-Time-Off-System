/**
 * GET /api/hcm/balances/batch?employeeIds=id1,id2,id3[&_scenario=<scenario>]
 *
 * Batch balance read for multiple employees in a single call.
 * Used by the manager's team-balance panel to avoid N individual requests.
 *
 * Each employee in the batch is subject to the same simulations as the
 * single-employee endpoint (anniversary bonus, inconsistent balance).
 * The `_scenario` param applies to ALL employees in the batch.
 *
 * Unknown employee IDs are silently omitted from the response (matching real
 * HCM batch behaviour where partial results are returned rather than a full
 * error). The caller must detect missing entries.
 *
 * Performance note: real HCM batch endpoints are meaningfully slower than
 * individual reads — the simulated latency reflects this (600–1200ms).
 */

import type { NextRequest } from 'next/server'
import {
  findEmployee,
  applyAnniversaryBonusIfDue,
  ANNIVERSARY_BONUS_DAYS,
  type EmployeeRecord,
} from '../../_store'
import {
  computeAnnualVariance,
  formatBalanceResponse,
  simulatedLatencyMs,
  type Scenario,
} from '../../_simulate'
import type { HCMLeaveBalance } from '@/lib/services/hcm/types'

export async function GET(request: NextRequest) {
  await new Promise((r) => setTimeout(r, simulatedLatencyMs('batch')))

  const params = request.nextUrl.searchParams
  const rawIds = params.get('employeeIds')
  const scenario = params.get('_scenario') as Scenario | null

  if (!rawIds) {
    return Response.json(
      { errorCode: 'MISSING_EMPLOYEE_IDS', errorMessage: 'employeeIds query parameter is required.' },
      { status: 400 }
    )
  }

  const employeeIds = rawIds
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  if (employeeIds.length === 0) {
    return Response.json(
      { errorCode: 'EMPTY_EMPLOYEE_IDS', errorMessage: 'employeeIds must contain at least one id.' },
      { status: 400 }
    )
  }

  if (employeeIds.length > 50) {
    return Response.json(
      { errorCode: 'BATCH_TOO_LARGE', errorMessage: 'Maximum 50 employee IDs per batch request.' },
      { status: 422 }
    )
  }

  const balances: HCMLeaveBalance[] = []
  const notFound: string[] = []

  for (const id of employeeIds) {
    const employee = findEmployee(id)
    if (!employee) {
      notFound.push(id)
      continue
    }

    // Anniversary bonus — applied independently per employee.
    let anniversaryApplied = false
    if (scenario === 'anniversary_force') {
      const currentYear = new Date().getFullYear()
      if (employee.anniversaryBonusAppliedYear !== currentYear) {
        employee.balance.ANNUAL += ANNIVERSARY_BONUS_DAYS
        employee.entitlement.ANNUAL += ANNIVERSARY_BONUS_DAYS
        employee.anniversaryBonusAppliedYear = currentYear
        anniversaryApplied = true
      }
    } else {
      anniversaryApplied = applyAnniversaryBonusIfDue(employee)
    }

    // Inconsistent balance — each employee gets an independent roll.
    const annualVariance = computeAnnualVariance(scenario ?? undefined)

    balances.push(formatBalanceResponse(employee, annualVariance, anniversaryApplied))
  }

  return Response.json({
    balances,
    syncedAt: new Date().toISOString(),
    ...(notFound.length > 0 && { notFound }),
  })
}
