import type { NextRequest } from 'next/server'
import { getCachedTeamBalances } from '@/lib/cache/wrappers'

// In production this list would come from the Time-Off service or HCM
const PLACEHOLDER_TEAM_USER_IDS: string[] = []

export async function GET(request: NextRequest) {
  const managerId = request.nextUrl.searchParams.get('managerId')
  if (!managerId) {
    return Response.json({ error: { code: 'VALIDATION', message: 'managerId is required.' } }, { status: 400 })
  }

  try {
    const userIds = PLACEHOLDER_TEAM_USER_IDS
    const balances = await getCachedTeamBalances(managerId, userIds)
    return Response.json({ data: balances, syncedAt: new Date().toISOString() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch team balances.'
    return Response.json({ error: { code: 'HCM_UNAVAILABLE', message } }, { status: 503 })
  }
}
