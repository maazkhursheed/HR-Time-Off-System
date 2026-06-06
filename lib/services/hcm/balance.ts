import { hcmFetch, TIMEOUTS } from './client'
import type { HCMLeaveBalance } from './types'
import type { LeaveBalance } from '@/types/leave'

function mapHCMBalance(raw: HCMLeaveBalance): LeaveBalance {
  const find = (code: string) =>
    raw.leaveTypes.find((lt) => lt.code === code)?.available ?? 0

  return {
    annual: find('ANNUAL'),
    sick: find('SICK'),
    unpaid: find('UNPAID'),
    compassionate: find('COMPASSIONATE'),
    lastSynced: raw.asOf,
  }
}

export async function fetchHCMBalance(userId: string): Promise<LeaveBalance> {
  const raw = await hcmFetch<HCMLeaveBalance>(`/employees/${userId}/leave-balance`, {
    timeoutMs: TIMEOUTS.realtime,
  })
  return mapHCMBalance(raw)
}

export async function fetchHCMTeamBalances(
  userIds: string[]
): Promise<Record<string, LeaveBalance>> {
  const raw = await hcmFetch<{ balances: HCMLeaveBalance[] }>(
    `/employees/leave-balances/batch`,
    {
      method: 'POST',
      body: JSON.stringify({ employeeIds: userIds }),
      timeoutMs: TIMEOUTS.batch,
    }
  )
  return Object.fromEntries(
    raw.balances.map((b) => [b.employeeId, mapHCMBalance(b)])
  )
}
