import type { NextRequest } from 'next/server'
import { getRequests } from '@/lib/services/timeoff/requests'

export const revalidate = 600 // 10 minutes

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const managerId = params.get('managerId')
  const from = params.get('from')
  const to = params.get('to')

  if (!managerId || !from || !to) {
    return Response.json(
      { error: { code: 'VALIDATION', message: 'managerId, from, and to are required.' } },
      { status: 400 }
    )
  }

  // In production: fetch all team member IDs, then get their approved requests in the date range
  return Response.json({ data: [] })
}
