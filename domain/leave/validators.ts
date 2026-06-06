import type { DateRange, LeaveType } from '@/types/leave'
import type { ValidationError } from '@/types/errors'

const MIN_NOTICE_DAYS: Record<LeaveType, number> = {
  annual: 3,
  sick: 0,
  unpaid: 5,
  compassionate: 0,
}

export function validateDateRange(range: DateRange): ValidationError | null {
  const start = new Date(range.startDate)
  const end = new Date(range.endDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { code: 'MIN_NOTICE_VIOLATION', message: 'Invalid date format.', field: 'startDate' }
  }
  if (start > end) {
    return { code: 'MIN_NOTICE_VIOLATION', message: 'Start date must be before end date.', field: 'startDate' }
  }
  return null
}

export function validateMinNotice(startDate: string, type: LeaveType): ValidationError | null {
  const start = new Date(startDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const minDays = MIN_NOTICE_DAYS[type]
  const diffMs = start.getTime() - today.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < minDays) {
    return {
      code: 'MIN_NOTICE_VIOLATION',
      message: `${type} leave requires at least ${minDays} business day(s) notice.`,
      field: 'startDate',
    }
  }
  return null
}

const BLACKOUT_DATES: string[] = []

export function validateBlackoutDates(range: DateRange): ValidationError | null {
  const start = new Date(range.startDate)
  const end = new Date(range.endDate)

  for (const blackout of BLACKOUT_DATES) {
    const d = new Date(blackout)
    if (d >= start && d <= end) {
      return {
        code: 'BLACKOUT_DATE',
        message: `The date ${blackout} is a company blackout date.`,
        field: 'startDate',
      }
    }
  }
  return null
}
