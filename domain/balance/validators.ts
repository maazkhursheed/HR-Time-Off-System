import type { LeaveBalance, LeaveType } from '@/types/leave'
import type { ValidationError } from '@/types/errors'

export function validateSufficientBalance(
  balance: LeaveBalance,
  type: LeaveType,
  businessDays: number
): ValidationError | null {
  if (type === 'unpaid' || type === 'compassionate') return null

  const available = balance[type as keyof Pick<LeaveBalance, 'annual' | 'sick'>]
  if (available < businessDays) {
    return {
      code: 'INSUFFICIENT_BALANCE',
      message: `Insufficient ${type} balance. Available: ${available} day(s), requested: ${businessDays} day(s).`,
      field: 'type',
    }
  }
  return null
}
