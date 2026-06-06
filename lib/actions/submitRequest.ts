'use server'

import { revalidateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache/tags'
import { validateDateRange, validateMinNotice, validateBlackoutDates } from '@/domain/leave/validators'
import type { LeaveType } from '@/types/leave'
import type { AppError } from '@/types/errors'

interface SubmitRequestInput {
  userId: string
  type: LeaveType
  startDate: string
  endDate: string
  businessDays: number
  notes?: string
  idempotencyKey: string
  managerId?: string
}

interface SubmitResult {
  success: boolean
  requestId?: string
  hcmStatus?: string
  error?: AppError
}

function getBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? 3000}`
}

export async function submitRequest(input: SubmitRequestInput): Promise<SubmitResult> {
  const rangeErr = validateDateRange({ startDate: input.startDate, endDate: input.endDate })
  if (rangeErr) return { success: false, error: rangeErr }

  const noticeErr = validateMinNotice(input.startDate, input.type)
  if (noticeErr) return { success: false, error: noticeErr }

  const blackoutErr = validateBlackoutDates({ startDate: input.startDate, endDate: input.endDate })
  if (blackoutErr) return { success: false, error: blackoutErr }

  try {
    const res = await fetch(`${getBaseUrl()}/api/hcm/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: input.userId,
        leaveTypeCode: input.type.toUpperCase(),
        startDate: input.startDate,
        endDate: input.endDate,
        days: input.businessDays,
        notes: input.notes,
        idempotencyKey: input.idempotencyKey,
      }),
    })

    const body = await res.json()

    if (!res.ok) {
      if (res.status === 422 && body.errorCode === 'INSUFFICIENT_BALANCE') {
        return {
          success: false,
          error: { code: 'INSUFFICIENT_BALANCE', message: body.errorMessage ?? 'Insufficient balance.' },
        }
      }
      return {
        success: false,
        error: { code: body.errorCode ?? 'UNKNOWN', message: body.errorMessage ?? 'Submission failed.' },
      }
    }

    revalidateTag(cacheTags.balance(input.userId), 'max')
    revalidateTag(cacheTags.requests(input.userId), 'max')
    if (input.managerId) {
      revalidateTag(cacheTags.teamRequests(input.managerId), 'max')
    }

    return { success: true, requestId: body.requestId, hcmStatus: body.status }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit request.'
    return { success: false, error: { code: 'UNKNOWN', message } }
  }
}
