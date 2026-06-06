'use client'

import { useCancelRequest } from '@/lib/mutations/useCancelRequest'
import { Badge, Button } from '@/components/ui'
import type { LeaveRequest } from '@/types/leave'

interface RequestCardProps {
  request: LeaveRequest
  userId: string
  managerId?: string
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual',
  sick: 'Sick',
  unpaid: 'Unpaid',
  compassionate: 'Compassionate',
}

export function RequestCard({ request, userId, managerId }: RequestCardProps) {
  const { mutate: cancel, isPending } = useCancelRequest()

  const canCancel = request.status === 'pending'

  return (
    <article className="rounded border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-900">
            {LEAVE_TYPE_LABELS[request.type] ?? request.type}
          </p>
          <p className="text-xs text-gray-500">
            {request.startDate} → {request.endDate}
            {' · '}
            {request.businessDays} day(s)
          </p>
          {request.notes && (
            <p className="text-xs text-gray-400">{request.notes}</p>
          )}
        </div>
        <Badge status={request.status}>
          {request.status.replace('_', ' ')}
        </Badge>
      </div>

      {canCancel && (
        <div className="mt-3 flex justify-end">
          <Button
            variant="danger"
            size="sm"
            loading={isPending}
            onClick={() => cancel({ requestId: request.id, userId, managerId })}
          >
            Cancel
          </Button>
        </div>
      )}
    </article>
  )
}
