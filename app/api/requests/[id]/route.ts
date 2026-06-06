import type { NextRequest } from 'next/server'
import { patchRequest } from '@/lib/services/timeoff/requests'
import type { PatchRequestBody } from '@/types/api'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: PatchRequestBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: { code: 'VALIDATION', message: 'Invalid request body.' } }, { status: 400 })
  }

  try {
    const updated = await patchRequest(id, body)
    return Response.json({ data: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update request.'
    return Response.json({ error: { code: 'UNKNOWN', message } }, { status: 500 })
  }
}
