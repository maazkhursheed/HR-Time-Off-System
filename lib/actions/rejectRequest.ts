'use server'

import { revalidateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache/tags'
import type { AppError } from '@/types/errors'

interface RejectResult {
  success: boolean
  error?: AppError
}

function getBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? 3000}`
}

export async function rejectRequest(
  requestId: string,
  managerId: string,
  employeeId: string,
  note?: string
): Promise<RejectResult> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/hcm/request/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', note }),
    })

    const body = await res.json()

    if (!res.ok) {
      return {
        success: false,
        error: { code: body.errorCode ?? 'UNKNOWN', message: body.errorMessage ?? 'Rejection failed.' },
      }
    }

    revalidateTag(cacheTags.requests(employeeId), 'max')
    revalidateTag(cacheTags.teamRequests(managerId), 'max')
    revalidateTag(cacheTags.balance(employeeId), 'max')

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reject request.'
    return { success: false, error: { code: 'UNKNOWN', message } }
  }
}
