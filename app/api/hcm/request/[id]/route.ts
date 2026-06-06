/**
 * GET /api/hcm/request/:id
 *
 * Fetch the current status of a single leave request.
 *
 * This endpoint is the mechanism through which the silent-failure simulation
 * (Pattern A, TRD §12.1) surfaces to the frontend. On each call:
 *
 *   • If the request was created as a normal PENDING request → returns PENDING
 *     (or APPROVED / REJECTED / CANCELLED if subsequently updated).
 *
 *   • If the request was a silent-failure request AND the silent-reject delay
 *     has elapsed → the store materialises the rejection and returns
 *     status REJECTED_BY_HCM with a rejection reason.
 *
 *   • If the request was a silent-failure request AND the delay has NOT yet
 *     elapsed → returns PENDING (indistinguishable from a normal request).
 *
 * The frontend's useRequest hook polls this endpoint every 2 minutes for
 * pending requests (refetchInterval: 120_000). The silent reject delay of
 * ~15s means it will surface on the first poll in test environments, but
 * realistic deployments can increase SILENT_REJECT_DELAY_MS in _store.ts.
 */

import type { NextRequest } from 'next/server'
import { findRequest, updateRequest } from '../../_store'
import { formatRequestResponse, simulatedLatencyMs } from '../../_simulate'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await new Promise((r) => setTimeout(r, simulatedLatencyMs('realtime')))

  const { id } = await params

  const record = findRequest(id)

  if (!record) {
    return Response.json(
      { errorCode: 'NOT_FOUND', errorMessage: `Request "${id}" not found.` },
      { status: 404 }
    )
  }

  return Response.json(formatRequestResponse(record))
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await new Promise((r) => setTimeout(r, simulatedLatencyMs('realtime')))

  const { id } = await params

  let body: { action: 'approve' | 'reject' | 'cancel'; note?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { errorCode: 'INVALID_BODY', errorMessage: 'Request body must be valid JSON.' },
      { status: 400 }
    )
  }

  if (!['approve', 'reject', 'cancel'].includes(body.action)) {
    return Response.json(
      { errorCode: 'INVALID_ACTION', errorMessage: 'action must be approve, reject, or cancel.' },
      { status: 422 }
    )
  }

  const result = updateRequest(id, body.action, body.note)

  if (!result.ok) {
    if (result.reason === 'NOT_FOUND') {
      return Response.json(
        { errorCode: 'NOT_FOUND', errorMessage: `Request "${id}" not found.` },
        { status: 404 }
      )
    }
    if (result.reason === 'ALREADY_TERMINAL') {
      return Response.json(
        { errorCode: 'ALREADY_TERMINAL', errorMessage: 'Request is already in a terminal state.' },
        { status: 409 }
      )
    }
    return Response.json(
      { errorCode: 'INVALID_TRANSITION', errorMessage: 'Cannot transition request from its current state.' },
      { status: 422 }
    )
  }

  return Response.json(formatRequestResponse(result.request))
}
