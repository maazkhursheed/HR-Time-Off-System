'use server'

import { revalidateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache/tags'
import type { AppError } from '@/types/errors'

interface ApproveResult {
  success: boolean
  error?: AppError
}

function getBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? 3000}`
}

export async function approveRequest(
  requestId: string,
  managerId: string,
  employeeId: string,
  note?: string
): Promise<ApproveResult> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/hcm/request/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', note }),
    })

    const body = await res.json()

    if (!res.ok) {
      return {
        success: false,
        error: { code: body.errorCode ?? 'UNKNOWN', message: body.errorMessage ?? 'Approval failed.' },
      }
    }

    revalidateTag(cacheTags.balance(employeeId), 'max')
    revalidateTag(cacheTags.requests(employeeId), 'max')
    revalidateTag(cacheTags.teamRequests(managerId), 'max')
    revalidateTag(cacheTags.teamBalance(managerId), 'max')
    revalidateTag(cacheTags.teamCalendar(managerId), 'max')

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to approve request.'
    return { success: false, error: { code: 'UNKNOWN', message } }
  }
}
