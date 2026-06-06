import type { LeaveStatus, LeaveType } from '@/types/leave'

type BadgeVariant = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'rejected_by_hcm' | 'neutral'

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
  rejected_by_hcm: 'bg-red-100 text-red-800',
  neutral: 'bg-gray-100 text-gray-700',
}

interface BadgeProps {
  variant?: BadgeVariant
  status?: LeaveStatus
  leaveType?: LeaveType
  children: React.ReactNode
}

export function Badge({ variant, status, leaveType, children }: BadgeProps) {
  const resolvedVariant = (status as BadgeVariant | undefined) ?? variant ?? 'neutral'
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${VARIANT_CLASSES[resolvedVariant]}`}>
      {children}
    </span>
  )
}
