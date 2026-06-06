'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useBalance, type RichBalance } from '@/lib/query/balance'
import { queryKeys } from '@/lib/query/keys'
import { minutesSinceSync } from '@/domain/balance/reconciliation'
import { HCMUnavailableBanner } from '@/components/errors/HCMUnavailableBanner'
import { Skeleton } from '@/components/ui/Skeleton/Skeleton'

interface BalancePanelClientProps {
  userId: string
}

export function BalancePanelClient({ userId }: BalancePanelClientProps) {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, dataUpdatedAt } = useBalance(userId)

  const minutesAgo = dataUpdatedAt > 0
    ? minutesSinceSync(new Date(dataUpdatedAt).toISOString())
    : undefined

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.balance(userId) })
  }

  if (isLoading && !data) return <BalancePanelSkeleton />
  if (isError && !data) return <HCMUnavailableBanner onRetry={handleRefresh} />

  return (
    <div className="space-y-3">
      {data && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">{data.employeeName}</span>
              {data.location && (
                <span className="text-xs text-gray-400">{data.location}</span>
              )}
            </div>
            {data.anniversaryBonusApplied && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                +2 anniversary days
              </span>
            )}
          </div>

          {data.isStale && minutesAgo !== undefined && (
            <HCMUnavailableBanner lastSyncedMinutesAgo={minutesAgo} onRetry={handleRefresh} />
          )}

          {data.inconsistencyDetected && !data.isStale && (
            <p className="rounded border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
              Balance may differ slightly from your ledger due to accrual timing.
            </p>
          )}

          <BalanceGrid balance={data} />

          <p className="text-xs text-gray-400">
            {minutesAgo !== undefined
              ? minutesAgo === 0 ? 'Synced just now' : `Synced ${minutesAgo}m ago`
              : 'Syncing...'}
            {' · '}
            <button onClick={handleRefresh} className="underline hover:no-underline">
              Refresh
            </button>
          </p>
        </>
      )}
    </div>
  )
}

const BALANCE_ENTRIES: { label: string; key: keyof RichBalance }[] = [
  { label: 'Annual', key: 'annual' },
  { label: 'Sick', key: 'sick' },
  { label: 'Unpaid', key: 'unpaid' },
  { label: 'Compassionate', key: 'compassionate' },
]

function BalanceGrid({ balance }: { balance: RichBalance }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {BALANCE_ENTRIES.map(({ label, key }) => {
        const days = balance[key] as number
        const isLow = key !== 'unpaid' && days <= 3
        return (
          <div key={label} className={`rounded border bg-white p-3 ${isLow ? 'border-yellow-300' : ''}`}>
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className={`mt-1 text-2xl font-semibold tabular-nums ${isLow ? 'text-yellow-700' : 'text-gray-900'}`}>
              {key === 'unpaid' ? '∞' : days}
              {key !== 'unpaid' && <span className="ml-1 text-sm font-normal text-gray-500">days</span>}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function BalancePanelSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded border p-3">
            <Skeleton className="mb-2 h-3 w-16" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}
