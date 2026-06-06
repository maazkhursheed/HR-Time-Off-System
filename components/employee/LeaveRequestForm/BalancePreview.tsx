'use client'

import { countBusinessDays } from '@/domain/leave/calculators'
import type { LeaveType } from '@/types/leave'
import type { RichBalance } from '@/lib/query/balance'

interface BalancePreviewProps {
  leaveType: LeaveType | null
  startDate: string
  endDate: string
  balance: RichBalance | undefined
}

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: 'Annual',
  sick: 'Sick',
  unpaid: 'Unpaid',
  compassionate: 'Compassionate',
}

export function BalancePreview({ leaveType, startDate, endDate, balance }: BalancePreviewProps) {
  if (!leaveType || !startDate || !endDate || !balance) return null

  const businessDays = countBusinessDays(startDate, endDate)
  if (businessDays <= 0) return null

  const currentBalance = balance[leaveType] as number
  const isUnlimited = leaveType === 'unpaid'
  const remaining = isUnlimited ? null : currentBalance - businessDays
  const insufficient = remaining !== null && remaining < 0

  return (
    <div
      className={`rounded border p-3 text-sm ${
        insufficient
          ? 'border-red-200 bg-red-50'
          : remaining !== null && remaining <= 3
          ? 'border-yellow-200 bg-yellow-50'
          : 'border-green-200 bg-green-50'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="font-medium text-gray-800">
        {LEAVE_TYPE_LABELS[leaveType]} leave · {businessDays} business day{businessDays !== 1 ? 's' : ''}
      </div>

      {isUnlimited ? (
        <div className="mt-1 text-gray-600">Unpaid leave has no balance limit.</div>
      ) : insufficient ? (
        <div className="mt-1 text-red-700">
          Insufficient balance. Available: {currentBalance} day{currentBalance !== 1 ? 's' : ''}.
          Requested: {businessDays} day{businessDays !== 1 ? 's' : ''}.
        </div>
      ) : (
        <div className="mt-1 text-gray-600">
          Balance: {currentBalance} → <strong className={remaining! <= 3 ? 'text-yellow-700' : 'text-green-700'}>{remaining}</strong> days remaining
        </div>
      )}
    </div>
  )
}
