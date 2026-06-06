'use client'

import Link from 'next/link'
import { useRequests } from '@/lib/query/requests'
import { Badge } from '@/components/ui/Badge/Badge'
import type { LeaveRequest } from '@/types/leave'

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual',
  sick: 'Sick',
  unpaid: 'Unpaid',
  compassionate: 'Compassionate',
}

function formatDateRange(start: string, end: string): string {
  if (start === end) return start
  return `${start} – ${end}`
}

interface RequestRowProps {
  request: LeaveRequest
}

function RequestRow({ request }: RequestRowProps) {
  const isContradiction = request.status === 'rejected_by_hcm'

  return (
    <li className={`flex items-center justify-between gap-3 rounded border px-4 py-3 ${
      isContradiction
        ? 'border-red-200 bg-red-50'
        : 'border-gray-200 bg-white'
    }`}>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-gray-900">
          {LEAVE_TYPE_LABELS[request.type] ?? request.type} leave
        </p>
        <p className="text-xs text-gray-500">
          {formatDateRange(request.startDate, request.endDate)}
          {' · '}
          {request.businessDays} day{request.businessDays !== 1 ? 's' : ''}
        </p>
        {isContradiction && (
          <p className="text-xs font-medium text-red-700">
            HCM rejected this request. Your balance has been restored.
          </p>
        )}
      </div>
      <Badge status={request.status}>
        {request.status === 'rejected_by_hcm' ? 'Rejected by HCM' : request.status}
      </Badge>
    </li>
  )
}

interface PendingRequestsBannerProps {
  userId: string
}

export function PendingRequestsBanner({ userId }: PendingRequestsBannerProps) {
  const { data: requests, isLoading } = useRequests(userId)

  if (isLoading) return null

  const active = requests?.filter(
    (r) => r.status === 'pending' || r.status === 'rejected_by_hcm'
  ) ?? []

  if (active.length === 0) return null

  const contradictions = active.filter((r) => r.status === 'rejected_by_hcm')

  return (
    <section aria-label="Active leave requests">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          Active Requests
        </h2>
        {contradictions.length > 0 && (
          <span className="text-xs font-medium text-red-600">
            {contradictions.length} HCM contradiction{contradictions.length !== 1 ? 's' : ''} detected
          </span>
        )}
      </div>
      <ul className="space-y-2">
        {active.map((r) => (
          <RequestRow key={r.id} request={r} />
        ))}
      </ul>
      <div className="mt-2">
        <Link href="/request" className="text-sm text-blue-600 hover:underline">
          + New request
        </Link>
      </div>
    </section>
  )
}
