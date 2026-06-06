import type { LeaveBalance, LeaveType } from '@/types/leave'

const WEEKEND_DAYS = new Set([0, 6]) // Sunday, Saturday

export function countBusinessDays(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  let count = 0
  const current = new Date(start)

  while (current <= end) {
    if (!WEEKEND_DAYS.has(current.getDay())) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }
  return count
}

export function previewRemainingBalance(
  balance: LeaveBalance,
  type: LeaveType,
  businessDays: number
): number {
  const current = balance[type as keyof Pick<LeaveBalance, 'annual' | 'sick' | 'unpaid' | 'compassionate'>]
  return Math.max(0, current - businessDays)
}

export function hasEnoughBalance(
  balance: LeaveBalance,
  type: LeaveType,
  businessDays: number
): boolean {
  if (type === 'unpaid' || type === 'compassionate') return true
  const available = balance[type as keyof Pick<LeaveBalance, 'annual' | 'sick'>]
  return available >= businessDays
}
