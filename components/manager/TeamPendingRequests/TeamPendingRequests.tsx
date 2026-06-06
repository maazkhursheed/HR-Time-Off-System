'use client'

import { useMemo } from 'react'
import { useTeamRequests } from '@/lib/query/team'
import { useTeamBalanceBatch } from '@/lib/query/balance'
import { RequestApprovalCard } from './RequestApprovalCard'
import { SkeletonText } from '@/components/ui/Skeleton/Skeleton'

interface TeamPendingRequestsProps {
  managerId: string
  teamMemberIds: string[]
}

export function TeamPendingRequests({ managerId, teamMemberIds }: TeamPendingRequestsProps) {
  const { data: requests, isLoading, isError, dataUpdatedAt } = useTeamRequests(managerId)

  const pending = useMemo(
    () => requests?.filter((r) => r.status === 'pending') ?? [],
    [requests]
  )

  // Always fetch balances for the full team roster, not just employees with pending
  // requests. Deriving IDs from `pending` caused the queryFn closure to shrink after
  // each optimistic update — the stale closure then executed when invalidateQueries
  // triggered a refetch, replacing TeamBalanceSummary's cache with incomplete data.
  const { data: balances } = useTeamBalanceBatch(teamMemberIds, managerId)
  const balanceByEmployee = useMemo(
    () => new Map(balances?.map((b) => [b.employeeId, b]) ?? []),
    [balances]
  )

  if (isLoading) return <SkeletonText lines={3} />
  if (isError) return <p className="text-sm text-red-600">Could not load pending requests.</p>

  if (!pending.length) {
    return <p className="text-sm text-gray-500">No pending approvals. Queue auto-refreshes every 30s.</p>
  }

  const lastSync = dataUpdatedAt > 0
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="space-y-3">
      {lastSync && (
        <p className="text-xs text-gray-400">
          {pending.length} pending · last updated {lastSync} · auto-refreshes every 30s
        </p>
      )}
      <ul className="space-y-3" aria-label="Pending approval requests">
        {pending.map((request) => (
          <li key={request.id}>
            <RequestApprovalCard
              request={request}
              managerId={managerId}
              employeeBalance={balanceByEmployee.get(request.userId)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
