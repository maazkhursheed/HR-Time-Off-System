'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from './keys'
import { STALE_TIMES } from './config'
import { isBalanceStale } from '@/domain/balance/reconciliation'

export interface RichBalance {
  employeeId: string
  employeeName: string
  location: string
  annual: number
  sick: number
  unpaid: number
  compassionate: number
  lastSynced: string
  anniversaryBonusApplied: boolean
  inconsistencyDetected: boolean
}

interface HCMBalanceEntry {
  code: string
  available: number
}

interface HCMBalanceRaw {
  employeeId: string
  employeeName?: string
  location?: string
  leaveTypes: HCMBalanceEntry[]
  asOf: string
  _meta?: { anniversaryBonusApplied: boolean; inconsistencyApplied: boolean }
}

function mapHCMBalance(raw: HCMBalanceRaw): RichBalance {
  const find = (code: string) =>
    raw.leaveTypes.find((lt) => lt.code === code)?.available ?? 0
  return {
    employeeId: raw.employeeId,
    employeeName: raw.employeeName ?? raw.employeeId,
    location: raw.location ?? '',
    annual: find('ANNUAL'),
    sick: find('SICK'),
    unpaid: find('UNPAID'),
    compassionate: find('COMPASSIONATE'),
    lastSynced: raw.asOf,
    anniversaryBonusApplied: raw._meta?.anniversaryBonusApplied ?? false,
    inconsistencyDetected: raw._meta?.inconsistencyApplied ?? false,
  }
}

export function useBalance(userId: string) {
  return useQuery({
    queryKey: queryKeys.balance(userId),
    queryFn: async () => {
      const res = await fetch(`/api/hcm/balance?employeeId=${userId}`)
      if (!res.ok) throw new Error(`Balance fetch failed: ${res.status}`)
      const raw: HCMBalanceRaw = await res.json()
      return mapHCMBalance(raw)
    },
    staleTime: STALE_TIMES.balance,
    refetchOnWindowFocus: true,
    select: (data) => ({ ...data, isStale: isBalanceStale(data.lastSynced) }),
  })
}

export function useTeamBalanceBatch(employeeIds: string[], managerId: string) {
  // Sort so callers with the same employees in different order share one cache entry.
  // Including sortedIds in the key ensures the queryFn closure is always correct for
  // that specific set of employees — prevents the collision where two components share
  // the same key but different closures and the last writer's queryFn wins on refetch.
  // invalidateQueries({ queryKey: queryKeys.teamBalance(managerId) }) still matches via
  // React Query prefix matching, so mutation invalidation continues to work unchanged.
  const sortedIds = useMemo(() => [...employeeIds].sort(), [employeeIds])

  return useQuery({
    queryKey: [...queryKeys.teamBalance(managerId), sortedIds],
    queryFn: async (): Promise<RichBalance[]> => {
      if (sortedIds.length === 0) return []
      const res = await fetch(`/api/hcm/balances/batch?employeeIds=${sortedIds.join(',')}`)
      if (!res.ok) throw new Error(`Team balance batch failed: ${res.status}`)
      const json: { balances: HCMBalanceRaw[] } = await res.json()
      return json.balances.map(mapHCMBalance)
    },
    enabled: sortedIds.length > 0,
    staleTime: STALE_TIMES.teamBalance,
    refetchOnWindowFocus: false,
    // Poll every 10 min (TRD §7.3). Matches staleTime so cache and interval stay
    // aligned. refetchOnWindowFocus is off — batch endpoint is expensive (600–1200 ms)
    // and manager tab-switching should not trigger it. The interval is the backstop.
    refetchInterval: STALE_TIMES.teamBalance,
  })
}
