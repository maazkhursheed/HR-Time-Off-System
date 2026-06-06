'use client'

import { useState } from 'react'
import { useApproveRequest } from '@/lib/mutations/useApproveRequest'
import { useRejectRequest } from '@/lib/mutations/useRejectRequest'
import { Badge, Button } from '@/components/ui'
import type { LeaveRequest } from '@/types/leave'
import type { RichBalance } from '@/lib/query/balance'

interface RequestApprovalCardProps {
  request: LeaveRequest
  managerId: string
  employeeBalance?: RichBalance
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual',
  sick: 'Sick',
  unpaid: 'Unpaid',
  compassionate: 'Compassionate',
}

export function RequestApprovalCard({ request, managerId, employeeBalance }: RequestApprovalCardProps) {
  const [note, setNote] = useState('')
  const { mutate: approve, isPending: isApproving } = useApproveRequest()
  const { mutate: reject, isPending: isRejecting } = useRejectRequest()
  const isBusy = isApproving || isRejecting

  const typeLabel = LEAVE_TYPE_LABELS[request.type] ?? request.type
  const currentBalance = employeeBalance ? (employeeBalance[request.type] as number) : undefined
  const afterBalance = currentBalance !== undefined ? currentBalance - request.businessDays : undefined
  const wouldOverdraw = afterBalance !== undefined && afterBalance < 0

  return (
    <article className="rounded border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">
              {employeeBalance?.employeeName ?? request.userId}
            </p>
            {employeeBalance?.location && (
              <span className="text-xs text-gray-400">{employeeBalance.location}</span>
            )}
          </div>
          <p className="text-sm text-gray-700">{typeLabel} leave</p>
          <p className="text-xs text-gray-500">
            {request.startDate} – {request.endDate}
            {' · '}
            {request.businessDays} business day{request.businessDays !== 1 ? 's' : ''}
          </p>
          {request.notes && (
            <p className="text-xs text-gray-400 italic">&ldquo;{request.notes}&rdquo;</p>
          )}
        </div>
        <Badge status={request.status}>{request.status}</Badge>
      </div>

      {currentBalance !== undefined && request.type !== 'unpaid' && (
        <div className={`mt-3 rounded px-3 py-2 text-xs ${
          wouldOverdraw
            ? 'bg-red-50 text-red-700'
            : afterBalance! <= 3
            ? 'bg-yellow-50 text-yellow-700'
            : 'bg-gray-50 text-gray-600'
        }`}>
          {wouldOverdraw ? (
            <>Balance insufficient: {currentBalance} available, {request.businessDays} requested.</>
          ) : (
            <>{typeLabel} balance: {currentBalance} → <strong>{afterBalance}</strong> days after approval</>
          )}
        </div>
      )}

      <div className="mt-3 space-y-2">
        <input
          type="text"
          placeholder="Optional note for employee"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={isBusy}
          className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
        />
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            loading={isApproving}
            disabled={isBusy}
            onClick={() =>
              approve({ requestId: request.id, managerId, employeeId: request.userId, note: note || undefined })
            }
          >
            Approve
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={isRejecting}
            disabled={isBusy}
            onClick={() =>
              reject({ requestId: request.id, managerId, employeeId: request.userId, note: note || undefined })
            }
          >
            Reject
          </Button>
        </div>
      </div>
    </article>
  )
}
