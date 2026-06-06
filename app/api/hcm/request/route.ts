/**
 * POST /api/hcm/request
 *
 * Submit a new leave request. The HCM system validates balance, creates the
 * request in PENDING state, and returns the created record.
 *
 * ── Simulations ──────────────────────────────────────────────────────────────
 *
 * 1. Insufficient balance rejection (deterministic)
 *    If the employee's available balance < requested days, returns 422.
 *    Force via: body `_scenario: "insufficient_balance"` (sets balance to 0
 *    in a shadow check without mutating the store).
 *
 * 2. Silent failure — Pattern A from TRD §12.1 (probabilistic / forced)
 *    12% of requests (or when `_scenario: "silent_failure"`) appear to succeed
 *    (HTTP 201 PENDING) but are internally flagged for deferred rejection.
 *    After SILENT_REJECT_DELAY_MS (~15s), GET /api/hcm/request/:id returns
 *    status REJECTED_BY_HCM. Balance is NOT deducted for these requests, so
 *    the frontend sees a Pending request with an unchanged balance — the exact
 *    contradiction the reconciliation layer is designed to detect.
 *
 * ── Idempotency ───────────────────────────────────────────────────────────────
 *    Requests with the same idempotencyKey return the original created record
 *    (HTTP 201) rather than creating a duplicate. The `_scenario` field on a
 *    retry is ignored once the original record exists.
 *
 * ── Request body ─────────────────────────────────────────────────────────────
 *    Matches HCMCreateRequestPayload from lib/services/hcm/types.ts plus an
 *    optional `_scenario` field for test overrides.
 */

import type { NextRequest } from 'next/server'
import {
  createRequest,
  findEmployee,
  SILENT_REJECT_DELAY_MS,
  type HCMLeaveCode,
} from '../_store'
import {
  formatRequestResponse,
  simulatedLatencyMs,
  SILENT_FAILURE_PROBABILITY,
  type Scenario,
} from '../_simulate'
import type { HCMCreateRequestPayload } from '@/lib/services/hcm/types'

type RequestBody = HCMCreateRequestPayload & { _scenario?: Scenario }

const VALID_LEAVE_CODES = new Set<HCMLeaveCode>(['ANNUAL', 'SICK', 'UNPAID', 'COMPASSIONATE'])

export async function POST(request: NextRequest) {
  await new Promise((r) => setTimeout(r, simulatedLatencyMs('realtime')))

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { errorCode: 'INVALID_BODY', errorMessage: 'Request body must be valid JSON.' },
      { status: 400 }
    )
  }

  // ── Input validation ────────────────────────────────────────────────────
  const missing = (['employeeId', 'leaveTypeCode', 'startDate', 'endDate', 'days', 'idempotencyKey'] as const)
    .filter((k) => body[k] === undefined || body[k] === null || body[k] === '')

  if (missing.length > 0) {
    return Response.json(
      {
        errorCode: 'VALIDATION_ERROR',
        errorMessage: `Missing required fields: ${missing.join(', ')}.`,
      },
      { status: 400 }
    )
  }

  const leaveTypeCode = body.leaveTypeCode.toUpperCase() as HCMLeaveCode
  if (!VALID_LEAVE_CODES.has(leaveTypeCode)) {
    return Response.json(
      {
        errorCode: 'INVALID_LEAVE_TYPE',
        errorMessage: `Unknown leave type code "${body.leaveTypeCode}". Valid codes: ANNUAL, SICK, UNPAID, COMPASSIONATE.`,
        field: 'leaveTypeCode',
      },
      { status: 422 }
    )
  }

  if (typeof body.days !== 'number' || body.days <= 0 || !Number.isInteger(body.days)) {
    return Response.json(
      { errorCode: 'INVALID_DAYS', errorMessage: 'days must be a positive integer.', field: 'days' },
      { status: 422 }
    )
  }

  const startDate = new Date(body.startDate)
  const endDate = new Date(body.endDate)
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
    return Response.json(
      { errorCode: 'INVALID_DATE_RANGE', errorMessage: 'startDate must be a valid date before or equal to endDate.', field: 'startDate' },
      { status: 422 }
    )
  }

  // ── Simulation 1: Forced insufficient balance ────────────────────────────
  // When _scenario=insufficient_balance, pretend the employee has 0 days
  // available regardless of their actual balance. This lets tests reliably
  // trigger the 422 path without needing a real zero-balance employee.
  if (body._scenario === 'insufficient_balance') {
    return Response.json(
      {
        errorCode: 'INSUFFICIENT_BALANCE',
        errorMessage: `Insufficient ANNUAL balance. Available: 0 day(s), requested: ${body.days} day(s).`,
        field: 'days',
      },
      { status: 422 }
    )
  }

  // ── Simulation 2: Silent failure determination ────────────────────────────
  const forceSilentFailure = body._scenario === 'silent_failure' ? true : undefined

  // ── Create the request ────────────────────────────────────────────────────
  const result = createRequest({
    employeeId: body.employeeId,
    leaveTypeCode,
    startDate: body.startDate,
    endDate: body.endDate,
    days: body.days,
    idempotencyKey: body.idempotencyKey,
    notes: body.notes,
    forceSilentFailure,
    silentFailureProbability: SILENT_FAILURE_PROBABILITY,
  })

  if (!result.ok) {
    if (result.reason === 'EMPLOYEE_NOT_FOUND') {
      return Response.json(
        { errorCode: 'EMPLOYEE_NOT_FOUND', errorMessage: `Employee "${body.employeeId}" not found.` },
        { status: 404 }
      )
    }
    if (result.reason === 'INSUFFICIENT_BALANCE') {
      const employee = findEmployee(body.employeeId)
      const available = employee?.balance[leaveTypeCode] ?? 0
      return Response.json(
        {
          errorCode: 'INSUFFICIENT_BALANCE',
          errorMessage: `Insufficient ${leaveTypeCode} balance. Available: ${available} day(s), requested: ${body.days} day(s).`,
          field: 'days',
        },
        { status: 422 }
      )
    }
    return Response.json({ errorCode: 'UNKNOWN', errorMessage: 'Unexpected error.' }, { status: 500 })
  }

  const created = result.request

  // Include a debug hint in the response when a silent failure was scheduled.
  // In a real HCM this field would not exist — it's here for observability.
  const responseBody: Record<string, unknown> = { ...formatRequestResponse(created) }
  if (created._willSilentlyReject) {
    responseBody._debug = {
      silentFailure: true,
      rejectsAt: new Date(created._silentRejectAt!).toISOString(),
      rejectsInMs: SILENT_REJECT_DELAY_MS,
    }
  }

  return Response.json(responseBody, { status: 201 })
}
