import type { NextRequest } from 'next/server'
import { getRequests } from '@/lib/services/timeoff/requests'
import type { SubmitRequestBody } from '@/types/api'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const userId = params.get('userId')
  if (!userId) {
    return Response.json({ error: { code: 'VALIDATION', message: 'userId is required.' } }, { status: 400 })
  }

  try {
    const status = params.get('status')?.split(',') as string[] | undefined
    const type = params.get('type')?.split(',') as string[] | undefined
    const page = params.get('page') ? Number(params.get('page')) : undefined

    const { requests, total } = await getRequests(userId, { status: status as any, type: type as any, page })
    return Response.json({ data: requests, total, page: page ?? 1 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch requests.'
    return Response.json({ error: { code: 'UNKNOWN', message } }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let body: SubmitRequestBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: { code: 'VALIDATION', message: 'Invalid request body.' } }, { status: 400 })
  }

  // Submission is handled via Server Actions; this Route Handler is for completeness
  return Response.json({ error: { code: 'USE_SERVER_ACTION', message: 'Use the submitRequest Server Action.' } }, { status: 405 })
}
