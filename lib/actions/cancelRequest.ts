'use server'

import { revalidateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache/tags'
import type { AppError } from '@/types/errors'

interface CancelResult {
  success: boolean
  error?: AppError
}

function getBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? 3000}`
}

export async function cancelRequest(
  requestId: string,
  userId: string,
  managerId?: string
): Promise<CancelResult> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/hcm/request/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })

    const body = await res.json()

    if (!res.ok) {
      return {
        success: false,
        error: { code: body.errorCode ?? 'UNKNOWN', message: body.errorMessage ?? 'Cancellation failed.' },
      }
    }

    revalidateTag(cacheTags.balance(userId), 'max')
    revalidateTag(cacheTags.requests(userId), 'max')
    if (managerId) {
      revalidateTag(cacheTags.teamRequests(managerId), 'max')
      revalidateTag(cacheTags.teamBalance(managerId), 'max')
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to cancel request.'
    return { success: false, error: { code: 'UNKNOWN', message } }
  }
}
