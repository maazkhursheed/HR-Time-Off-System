import type { NextRequest } from 'next/server'
import { getCachedBalance } from '@/lib/cache/wrappers'

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId) {
    return Response.json({ error: { code: 'VALIDATION', message: 'userId is required.' } }, { status: 400 })
  }

  try {
    const balance = await getCachedBalance(userId)
    return Response.json({ data: balance })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch balance.'
    return Response.json({ error: { code: 'HCM_UNAVAILABLE', message } }, { status: 503 })
  }
}
