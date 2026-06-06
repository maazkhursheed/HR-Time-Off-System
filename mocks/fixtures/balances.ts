import type { LeaveBalance } from '@/types/leave'

export const MOCK_BALANCE: LeaveBalance = {
  annual: 10,
  sick: 5,
  unpaid: 0,
  compassionate: 3,
  lastSynced: new Date().toISOString(),
}

export const MOCK_ZERO_BALANCE: LeaveBalance = {
  annual: 0,
  sick: 0,
  unpaid: 0,
  compassionate: 0,
  lastSynced: new Date().toISOString(),
}

export const MOCK_TEAM_BALANCES: Record<string, LeaveBalance> = {
  'user-emp-001': { annual: 10, sick: 5, unpaid: 0, compassionate: 3, lastSynced: new Date().toISOString() },
  'user-emp-002': { annual: 3, sick: 8, unpaid: 2, compassionate: 0, lastSynced: new Date().toISOString() },
}
