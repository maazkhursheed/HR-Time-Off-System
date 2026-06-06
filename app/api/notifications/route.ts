import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId) {
    return Response.json({ error: { code: 'VALIDATION', message: 'userId is required.' } }, { status: 400 })
  }

  // Stub — real implementation fetches from notification store
  return Response.json({ data: [], unreadCount: 0 })
}

export async function PATCH(_request: NextRequest) {
  // Stub — mark all read
  return Response.json({ success: true })
}
