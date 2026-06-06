import type { NextRequest } from 'next/server'
import { getTeamRequests } from '@/lib/services/timeoff/requests'

export async function GET(request: NextRequest) {
  const managerId = request.nextUrl.searchParams.get('managerId')
  if (!managerId) {
    return Response.json({ error: { code: 'VALIDATION', message: 'managerId is required.' } }, { status: 400 })
  }

  try {
    const { requests, total } = await getTeamRequests(managerId)
    return Response.json({ data: requests, total })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch team requests.'
    return Response.json({ error: { code: 'UNKNOWN', message } }, { status: 500 })
  }
}
