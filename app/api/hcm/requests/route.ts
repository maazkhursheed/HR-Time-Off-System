/**
 * GET /api/hcm/requests?employeeId=<id>   — list all requests for an employee
 * GET /api/hcm/requests?managerId=<id>    — list pending requests for a manager's team
 *
 * Returns: { requests: HCMLeaveRequest[], total: number }
 * Silently materialises any elapsed silent rejections before returning.
 */

import type { NextRequest } from 'next/server'
import { listRequestsByEmployee, listRequestsByManager } from '../_store'
import { formatRequestResponse, simulatedLatencyMs } from '../_simulate'

export async function GET(request: NextRequest) {
  await new Promise((r) => setTimeout(r, simulatedLatencyMs('realtime')))

  const params = request.nextUrl.searchParams
  const employeeId = params.get('employeeId')
  const managerId = params.get('managerId')

  if (!employeeId && !managerId) {
    return Response.json(
      { errorCode: 'MISSING_PARAM', errorMessage: 'Provide employeeId or managerId.' },
      { status: 400 }
    )
  }

  const records = employeeId
    ? listRequestsByEmployee(employeeId)
    : listRequestsByManager(managerId!)

  const requests = records.map(formatRequestResponse)

  return Response.json({ requests, total: requests.length })
}
