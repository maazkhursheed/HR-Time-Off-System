'use client'

import { useRequests } from '@/lib/query/requests'
import { useUIStore } from '@/store/useUIStore'
import { RequestCard } from './RequestCard'
import { SkeletonText } from '@/components/ui/Skeleton/Skeleton'

interface RequestHistoryProps {
  userId: string
}

export function RequestHistory({ userId }: RequestHistoryProps) {
  const activeFilters = useUIStore((s) => s.activeFilters)
  const { data, isLoading, isError } = useRequests(userId)

  if (isLoading) return <SkeletonText lines={4} />
  if (isError) return <p className="text-sm text-red-600">Could not load request history.</p>

  const filtered = data?.filter((r) => {
    if (activeFilters.status.length && !activeFilters.status.includes(r.status)) return false
    if (activeFilters.type.length && !activeFilters.type.includes(r.type)) return false
    return true
  }) ?? []

  if (!filtered.length) return <p className="text-sm text-gray-500">No leave requests found.</p>

  return (
    <ul className="space-y-3" aria-label="Leave request history">
      {filtered.map((request) => (
        <li key={request.id}>
          <RequestCard request={request} userId={userId} />
        </li>
      ))}
    </ul>
  )
}
