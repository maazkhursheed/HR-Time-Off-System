'use client'

import { useTeamBalanceBatch } from '@/lib/query/balance'
import { SkeletonText } from '@/components/ui/Skeleton/Skeleton'
import { minutesSinceSync } from '@/domain/balance/reconciliation'
import type { RichBalance } from '@/lib/query/balance'

const SEED_TEAM_IDS = ['user-emp-001', 'user-emp-002', 'user-emp-003']

interface TeamBalanceSummaryProps {
  managerId: string
  teamMemberIds?: string[]
}

function BalanceCell({ value, warn }: { value: number; warn?: boolean }) {
  return (
    <td className={`px-4 py-3 tabular-nums ${warn ? 'font-semibold text-yellow-700' : 'text-gray-700'}`}>
      {value}
    </td>
  )
}

function BalanceRow({ balance }: { balance: RichBalance }) {
  const isLowAnnual = balance.annual <= 3
  const isLowSick = balance.sick <= 2

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-gray-900">{balance.employeeName}</div>
        <div className="text-xs text-gray-400">{balance.location}</div>
      </td>
      <BalanceCell value={balance.annual} warn={isLowAnnual} />
      <BalanceCell value={balance.sick} warn={isLowSick} />
      <td className="px-4 py-3 text-gray-500">∞</td>
      <BalanceCell value={balance.compassionate} />
      <td className="px-4 py-3">
        {balance.anniversaryBonusApplied && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">+bonus</span>
        )}
      </td>
    </tr>
  )
}

export function TeamBalanceSummary({ managerId, teamMemberIds }: TeamBalanceSummaryProps) {
  const ids = teamMemberIds ?? SEED_TEAM_IDS
  const { data: balances, isLoading, isError, dataUpdatedAt } = useTeamBalanceBatch(ids, managerId)

  const syncedAt = dataUpdatedAt > 0
    ? minutesSinceSync(new Date(dataUpdatedAt).toISOString())
    : undefined

  if (isLoading) return <SkeletonText lines={3} />
  if (isError) return <p className="text-sm text-red-600">Could not load team balances.</p>
  if (!balances?.length) return <p className="text-sm text-gray-500">No team balance data available.</p>

  return (
    <div className="space-y-2">
      {syncedAt !== undefined && (
        <p className="text-xs text-gray-400">
          {syncedAt === 0 ? 'Synced just now' : `Synced ${syncedAt}m ago`}
        </p>
      )}
      <div className="overflow-hidden rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Employee</th>
              <th className="px-4 py-2">Annual</th>
              <th className="px-4 py-2">Sick</th>
              <th className="px-4 py-2">Unpaid</th>
              <th className="px-4 py-2">Compassionate</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {balances.map((b) => (
              <BalanceRow key={b.employeeId} balance={b} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
